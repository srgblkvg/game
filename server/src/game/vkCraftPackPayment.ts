import type { CraftCatalogItem } from './donateCraftPackDelivery';

export interface VkCraftPackTransaction {
  claim(input: { provider: 'vk'; externalId: string; providerUserId: number; item: string }): Promise<{ provider: 'vk'; externalId: string; providerUserId: number; item: string; status: string }>;
  lockVkUser(vkUserId: number): Promise<{ id: number; inventory: string; bank: number | null } | null>;
  findCraftItems(names: string[]): Promise<CraftCatalogItem[]>;
  saveUser(characterId: number, inventory: string, bankDelta: number): Promise<void>;
  logPayment(input: { orderId: string; vkUserId: number; characterId: number; item: string; processedAt: number }): Promise<void>;
  markSucceeded(orderId: string, processedAt: number, characterId: number): Promise<void>;
}
export interface VkCraftPackRepository { transaction<T>(callback: (tx: VkCraftPackTransaction) => Promise<T>): Promise<T>; }
interface Input { orderId: string; vkUserId: number; item: string; providerPrice: number; processedAt: number; }
type Result={status:'delivered';characterId:number;item:string}|{status:'already-processed'}|{status:'rejected';reason:string};
const RECIPES:Record<string,{price:number;bank:number;required:{name:string;count:number}[]}>= {
  craft_rare:{price:14,bank:10000,required:[{name:'Сердцевина бездны',count:5},{name:'Рунный булыжник',count:6}]},
  craft_epic:{price:28,bank:30000,required:[{name:'Искра погибели',count:5},{name:'Рунный булыжник',count:10}]},
};
export async function processVkCraftPackPayment(repository:VkCraftPackRepository,input:Input):Promise<Result>{
 const recipe=RECIPES[input.item];
 if(!input.orderId||!Number.isInteger(input.vkUserId)||input.vkUserId<=0||!recipe||input.providerPrice!==recipe.price)return{status:'rejected',reason:'payment-mismatch'};
 return repository.transaction(async tx=>{
  const claim=await tx.claim({provider:'vk',externalId:input.orderId,providerUserId:input.vkUserId,item:input.item});
  if(claim.provider!=='vk'||claim.externalId!==input.orderId||claim.providerUserId!==input.vkUserId||claim.item!==input.item)return{status:'rejected',reason:'claim-identity-mismatch'};
  if(claim.status==='succeeded')return{status:'already-processed'};
  if(claim.status!=='pending')return{status:'rejected',reason:'claim-status'};
  const user=await tx.lockVkUser(input.vkUserId);if(!user)return{status:'rejected',reason:'character-not-found'};
  let inventory:any;try{inventory=JSON.parse(user.inventory||'[]');}catch{return{status:'rejected',reason:'invalid-inventory'};}
  if(!Array.isArray(inventory))return{status:'rejected',reason:'invalid-inventory'};
  const catalog=await tx.findCraftItems(recipe.required.map(x=>x.name));
  if(catalog.length!==recipe.required.length||recipe.required.some(r=>catalog.filter(i=>i.name===r.name).length!==1))return{status:'rejected',reason:'catalog-item-missing'};
  const byName=new Map(catalog.map(i=>[i.name,i]));
  for(const required of recipe.required){const item=byName.get(required.name)!;const matches=inventory.filter((e:any)=>(e?.type==='craft_item'||e?.type==='material')&&Number(e.id)===item.id);if(matches.length>1)return{status:'rejected',reason:'invalid-inventory'};const existing=matches[0];if(existing){const count=Number(existing.count);if(!Number.isInteger(count)||count<0)return{status:'rejected',reason:'invalid-inventory'};existing.count=count+required.count;}else inventory.push({type:'craft_item',id:item.id,name:item.name,rarity_id:item.rarityId,rarity_display:item.rarityDisplay,rarity_color:item.rarityColor,count:required.count,itemType:item.type||'craft',image:item.image||null});}
  await tx.saveUser(user.id,JSON.stringify(inventory),recipe.bank);
  await tx.logPayment({orderId:input.orderId,vkUserId:input.vkUserId,characterId:user.id,item:input.item,processedAt:input.processedAt});
  await tx.markSucceeded(input.orderId,input.processedAt,user.id);
  return{status:'delivered',characterId:user.id,item:input.item};
 });
}
