/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { processYooKassaCraftRarePayment } from './donateCraftPackDelivery';
import { createPgDonateCraftPackRepository } from './donateCraftPackDeliveryRepository';
const run=process.env.RUN_PG_TESTS==='1'; const pgTest=run?test:test.skip;
pgTest('concurrent craft_rare callback delivers both stacks and bank once',async()=>{
 const uid=Number((await pool.query("INSERT INTO users(username,passwordhash,inventory,bank) VALUES('craft-pg','x','[]',0) RETURNING id")).rows[0].id);
 const pid='craft-pg-'+Date.now();
 try{
  await pool.query("INSERT INTO rarities(id,display_name,color) VALUES(0,'Обычный','#aaa'),(4,'Легендарный','#f00')");
  await pool.query("INSERT INTO craft_items(id,name,rarity_id,type,image) VALUES(10,'Сердцевина бездны',4,'craft','/core'),(11,'Рунный булыжник',0,'upgrade','/stone')");
  await pool.query("INSERT INTO yukassa_payments(payment_id,user_id,item,amount,status,processed_at) VALUES($1,$2,'craft_rare','99.00','pending',1)",[pid,uid]);
  const input={paymentId:pid,providerUserId:String(uid),providerItem:'craft_rare',verifiedAmount:'99.00',verifiedCurrency:'RUB',processedAt:2};
  const results=await Promise.all([processYooKassaCraftRarePayment(createPgDonateCraftPackRepository(),input),processYooKassaCraftRarePayment(createPgDonateCraftPackRepository(),input)]);
  assert.deepEqual(results.map(r=>r.status).sort(),['already-processed','delivered']);
  const u=(await pool.query('SELECT inventory,bank FROM users WHERE id=$1',[uid])).rows[0]; const inv=typeof u.inventory==='string'?JSON.parse(u.inventory):u.inventory;
  assert.equal(Number(u.bank),10000); assert.equal(inv.find((i:any)=>i.id===10).count,5); assert.equal(inv.find((i:any)=>i.id===11).count,6);
 }finally{await pool.query('DELETE FROM yukassa_payments WHERE payment_id=$1',[pid]);await pool.query('DELETE FROM users WHERE id=$1',[uid]);await pool.query('DELETE FROM craft_items');await pool.query('DELETE FROM rarities');}
});
test.after(async()=>{if(run)await pool.end();});
