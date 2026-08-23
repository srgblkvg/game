import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { DonateCraftPackRepository, DonateCraftPackTransaction } from './donateCraftPackDelivery';
import {serializeInventoryJson} from './donateInventoryRecipe';

function adapter(client: PoolClient): DonateCraftPackTransaction {
  return {
    async lockPayment(paymentId) {
      const r=(await client.query('SELECT payment_id,user_id,item,amount,status FROM yukassa_payments WHERE payment_id=$1 FOR UPDATE',[paymentId])).rows[0];
      return r ? {paymentId:r.payment_id,userId:Number(r.user_id),item:r.item,amount:String(r.amount),status:r.status}:null;
    },
    async lockUser(userId) {
      const r=(await client.query('SELECT id,inventory,bank FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
      return r ? {id:Number(r.id),inventory:serializeInventoryJson(r.inventory),bank:r.bank===null?null:Number(r.bank)}:null;
    },
    async findCraftItems(names) {
      const rows=(await client.query(`SELECT c.id,c.name,c.rarity_id,c.type,c.image,r.display_name,r.color FROM craft_items c JOIN rarities r ON c.rarity_id=r.id WHERE c.name=ANY($1::text[])`,[names])).rows;
      return rows.map(r=>({id:Number(r.id),name:r.name,rarityId:Number(r.rarity_id),type:r.type,image:r.image,rarityDisplay:r.display_name,rarityColor:r.color}));
    },
    async saveUser(userId,inventory,bankDelta) { await client.query('UPDATE users SET inventory=$1,bank=COALESCE(bank,0)+$2 WHERE id=$3',[inventory,bankDelta,userId]); },
    async markSucceeded(paymentId,processedAt) {
      const r=await client.query("UPDATE yukassa_payments SET status='succeeded',processed_at=$1 WHERE payment_id=$2 AND status='pending'",[processedAt,paymentId]);
      if(r.rowCount!==1) throw new Error('payment status update failed');
    },
  };
}
export function createPgDonateCraftPackRepository():DonateCraftPackRepository { return {transaction:cb=>db.tx(c=>cb(adapter(c)))}; }
