import {applyInventoryRecipe,type InventoryCatalogItem} from './donateInventoryRecipe';
export const STARTER_SLOTS=['weapon1','shield','helmet','chest','gloves','boots','amulet','ring','belt'] as const;
export interface StarterEquipmentTemplate{id:number;name:string;slot:string;rarityId:number;bonuses:Record<string,unknown>;extra:Record<string,unknown>;image:string|null}
type Result={ok:true;inventory:any[];inventoryJson:string}|{ok:false;reason:string};
const plainObject=(value:unknown)=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function applyStarterPackRecipe(inventoryJson:string,templates:StarterEquipmentTemplate[],essenceCatalog:InventoryCatalogItem[],createId:()=>string|number):Result{
 if(templates.length!==STARTER_SLOTS.length)return{ok:false,reason:'equipment-template-missing'};
 if(new Set(templates.map(item=>item.id)).size!==templates.length)return{ok:false,reason:'invalid-equipment-template'};
 const bySlot=new Map<string,StarterEquipmentTemplate>();
 for(const item of templates){if(!Number.isInteger(item.id)||item.id<=0||item.rarityId!==2||!STARTER_SLOTS.includes(item.slot as any)||typeof item.name!=='string'||!item.name||!plainObject(item.bonuses)||!plainObject(item.extra)||(item.image!==null&&typeof item.image!=='string')||bySlot.has(item.slot))return{ok:false,reason:'invalid-equipment-template'};bySlot.set(item.slot,item);}
 if(STARTER_SLOTS.some(slot=>!bySlot.has(slot)))return{ok:false,reason:'equipment-template-missing'};
 let inventory:any;try{inventory=JSON.parse(inventoryJson||'[]');}catch{return{ok:false,reason:'invalid-inventory'};}if(!Array.isArray(inventory))return{ok:false,reason:'invalid-inventory'};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;const existingIds=new Set<string>();for(const item of inventory){if(!item||typeof item!=='object'||(typeof item.id!=='string'&&typeof item.id!=='number'))return{ok:false,reason:'invalid-inventory'};const id=String(item.id);if((typeof item.id==='string'&&!uuid.test(item.id))||(typeof item.id==='number'&&(!Number.isSafeInteger(item.id)||item.id<=0))||existingIds.has(id))return{ok:false,reason:'invalid-inventory'};if(item.type==='craft_item'||item.type==='material'){if(!Number.isInteger(item.count)||item.count<0)return{ok:false,reason:'invalid-inventory'};}else if(typeof item.slot!=='string'||!item.slot)return{ok:false,reason:'invalid-inventory'};existingIds.add(id);}
 const generated=new Set<string>();const equipment:any[]=[];
 for(const slot of STARTER_SLOTS){const template=bySlot.get(slot)!;const id=createId();if(typeof id!=='string'||!uuid.test(id)||generated.has(id)||existingIds.has(id))return{ok:false,reason:'invalid-instance-id'};generated.add(id);equipment.push({id,name:template.name,slot:template.slot,rarity_id:template.rarityId,bonuses:{...template.bonuses},extra:{...template.extra},image:template.image});}
 const stacked=applyInventoryRecipe(JSON.stringify([...inventory,...equipment]),essenceCatalog,{entries:[{name:'Эссенция мрака',count:4}],bankDelta:0});
 if(!stacked.ok)return stacked;
 return{ok:true,inventory:stacked.inventory,inventoryJson:stacked.inventoryJson};
}
