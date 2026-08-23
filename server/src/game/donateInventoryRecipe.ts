export interface InventoryCatalogItem {
  id:number;name:string;rarityId:number;type:string;image:string|null;rarityDisplay:string;rarityColor:string;
}
export interface InventoryRecipe { entries:ReadonlyArray<{name:string;count:number}>;bankDelta:number; }
type Result={ok:true;inventory:any[];inventoryJson:string;bankDelta:number}|{ok:false;reason:string};
export function serializeInventoryJson(value:unknown):string{if(typeof value==='string')return value;const encoded=JSON.stringify(value);return typeof encoded==='string'?encoded:'null';}
export function applyInventoryRecipe(inventoryJson:string,catalog:InventoryCatalogItem[],recipe:InventoryRecipe,multiplier=1):Result{
 if(!Number.isInteger(multiplier)||multiplier<=0)return{ok:false,reason:'invalid-multiplier'};
 let inventory:any;try{inventory=JSON.parse(inventoryJson||'[]');}catch{return{ok:false,reason:'invalid-inventory'};}
 if(!Array.isArray(inventory))return{ok:false,reason:'invalid-inventory'};
 if(catalog.some(item=>!Number.isInteger(item.id)||item.id<=0||typeof item.name!=='string'||!item.name||!Number.isInteger(item.rarityId)||item.rarityId<0||typeof item.type!=='string'||!item.type||typeof item.rarityDisplay!=='string'||!item.rarityDisplay||typeof item.rarityColor!=='string'||!item.rarityColor||(item.image!==null&&typeof item.image!=='string')))return{ok:false,reason:'invalid-catalog'};
 if(new Set(catalog.map(item=>item.id)).size!==catalog.length)return{ok:false,reason:'invalid-catalog'};
 if(catalog.length!==recipe.entries.length||recipe.entries.some(e=>catalog.filter(i=>i.name===e.name).length!==1))return{ok:false,reason:'catalog-item-missing'};
 const byName=new Map(catalog.map(i=>[i.name,i]));
 for(const entry of recipe.entries){if(!Number.isInteger(entry.count)||entry.count<=0)return{ok:false,reason:'invalid-recipe'};const item=byName.get(entry.name)!;const matches=inventory.filter((v:any)=>(v?.type==='craft_item'||v?.type==='material')&&Number(v.id)===item.id);if(matches.length>1)return{ok:false,reason:'invalid-inventory'};const existing=matches[0];const add=entry.count*multiplier;if(existing){const count=existing.count;if(typeof count!=='number'||!Number.isInteger(count)||count<0)return{ok:false,reason:'invalid-inventory'};existing.count=count+add;}else inventory.push({type:'craft_item',id:item.id,name:item.name,rarity_id:item.rarityId,rarity_display:item.rarityDisplay,rarity_color:item.rarityColor,count:add,itemType:item.type||'craft',image:item.image||null});}
 return{ok:true,inventory,inventoryJson:JSON.stringify(inventory),bankDelta:recipe.bankDelta*multiplier};
}
