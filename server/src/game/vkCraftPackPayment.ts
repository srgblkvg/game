import type { CraftCatalogItem } from './donateCraftPackDelivery';
import {applyInventoryRecipe} from './donateInventoryRecipe';

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
  const catalog=await tx.findCraftItems(recipe.required.map(x=>x.name));
  const applied=applyInventoryRecipe(user.inventory,catalog,{entries:recipe.required,bankDelta:recipe.bank});if(!applied.ok)return{status:'rejected',reason:applied.reason};
  await tx.saveUser(user.id,applied.inventoryJson,applied.bankDelta);
  await tx.logPayment({orderId:input.orderId,vkUserId:input.vkUserId,characterId:user.id,item:input.item,processedAt:input.processedAt});
  await tx.markSucceeded(input.orderId,input.processedAt,user.id);
  return{status:'delivered',characterId:user.id,item:input.item};
 });
}
