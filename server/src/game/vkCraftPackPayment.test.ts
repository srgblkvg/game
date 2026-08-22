/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { processVkCraftPackPayment, type VkCraftPackRepository, type VkCraftPackTransaction } from './vkCraftPackPayment';

function repository(options:{item?:string;items?:any[]}={}) {
  let claim:any={provider:'vk',externalId:'order-pack',providerUserId:77,item:options.item??'craft_rare',status:'pending'};
  let inventory='[]'; let bank:number|null=null; const writes:string[]=[];
  const tx:VkCraftPackTransaction={
    async claim(){return {...claim};},
    async lockVkUser(){return {id:7,inventory,bank};},
    async findCraftItems(){return options.items??[
      {id:10,name:'Сердцевина бездны',rarityId:4,type:'craft',image:'/core',rarityDisplay:'Легендарный',rarityColor:'#f00'},
      {id:11,name:'Рунный булыжник',rarityId:0,type:'upgrade',image:'/stone',rarityDisplay:'Обычный',rarityColor:'#aaa'},
    ];},
    async saveUser(_id,next,delta){inventory=next;bank=(bank??0)+delta;writes.push('user');},
    async logPayment(){writes.push('log');}, async markSucceeded(){claim.status='succeeded';writes.push('succeeded');},
  };
  const repo:VkCraftPackRepository={transaction:cb=>cb(tx)};
  return {repo,state:()=>({claim,inventory:JSON.parse(inventory),bank,writes})};
}
const input={orderId:'order-pack',vkUserId:77,item:'craft_rare',providerPrice:14,processedAt:123};

test('VK craft_rare claim, оба стака, bank, log и succeeded выполняются одной transaction',async()=>{
 const s=repository(); const result=await processVkCraftPackPayment(s.repo,input);
 assert.deepEqual(result,{status:'delivered',characterId:7,item:'craft_rare'});
 assert.equal(s.state().inventory.find((i:any)=>i.id===10).count,5);
 assert.equal(s.state().inventory.find((i:any)=>i.id===11).count,6);
 assert.equal(s.state().bank,10000); assert.deepEqual(s.state().writes,['user','log','succeeded']);
});

test('повторный VK callback не выдаёт pack снова',async()=>{
 const s=repository(); await processVkCraftPackPayment(s.repo,input); const before=structuredClone(s.state());
 const result=await processVkCraftPackPayment(s.repo,input); assert.equal(result.status,'already-processed');
 assert.deepEqual(s.state().inventory,before.inventory); assert.equal(s.state().bank,before.bank);
});

test('неверная VK price отклоняется до transaction',async()=>{
 const s=repository(); const result=await processVkCraftPackPayment(s.repo,{...input,providerPrice:99});
 assert.equal(result.status,'rejected'); assert.deepEqual(s.state().writes,[]);
});

test('VK craft_epic выдаёт exact recipe по цене 28 голосов',async()=>{
 const items=[
  {id:12,name:'Искра погибели',rarityId:5,type:'craft',image:'/spark',rarityDisplay:'Эпический',rarityColor:'#a0f'},
  {id:11,name:'Рунный булыжник',rarityId:0,type:'upgrade',image:'/stone',rarityDisplay:'Обычный',rarityColor:'#aaa'},
 ];
 const s=repository({item:'craft_epic',items});
 const result=await processVkCraftPackPayment(s.repo,{...input,item:'craft_epic',providerPrice:28});
 assert.deepEqual(result,{status:'delivered',characterId:7,item:'craft_epic'});
 assert.equal(s.state().inventory.find((i:any)=>i.id===12).count,5);
 assert.equal(s.state().inventory.find((i:any)=>i.id===11).count,10);
 assert.equal(s.state().bank,30000);
});
