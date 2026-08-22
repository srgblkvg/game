/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { processVkSilverPayment } from './vkPaymentDelivery';
import { createPgVkPaymentDeliveryRepository, ensureVkPaymentDeliveryReady } from './vkPaymentDeliveryRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

async function user(label: string, vkUserId: number, bank: number) {
  return Number((await pool.query(`INSERT INTO users (username, passwordhash, oauthprovider, oauthid, bank)
    VALUES ($1, 'test', 'vk', $2, $3) RETURNING id`, [`vk-payment-${label}-${Date.now()}`, String(vkUserId), bank])).rows[0].id);
}

const input = (orderId: string, vkUserId: number) => ({
  orderId, vkUserId, item: 'silver_10000', providerPrice: 7, processedAt: 1234,
});

pgTest('два concurrent VK callbacks доставляют silver один раз', async () => {
  await ensureVkPaymentDeliveryReady();
  const vkUserId = 900000001;
  const characterId = await user('parallel', vkUserId, 5);
  const orderId = `vk-parallel-${Date.now()}`;
  try {
    const results = await Promise.all([
      processVkSilverPayment(createPgVkPaymentDeliveryRepository(), input(orderId, vkUserId)),
      processVkSilverPayment(createPgVkPaymentDeliveryRepository(), input(orderId, vkUserId)),
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), ['already-processed', 'delivered']);
    assert.equal(Number((await pool.query('SELECT bank FROM users WHERE id=$1', [characterId])).rows[0].bank), 10005);
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM vk_payments WHERE order_id=$1', [orderId])).rows[0].n), 1);
    assert.equal((await pool.query("SELECT status FROM payment_deliveries WHERE provider='vk' AND external_id=$1", [orderId])).rows[0].status, 'succeeded');
  } finally {
    await pool.query("DELETE FROM payment_deliveries WHERE provider='vk' AND external_id=$1", [orderId]);
    await pool.query('DELETE FROM vk_payments WHERE order_id=$1', [orderId]);
    await pool.query('DELETE FROM users WHERE id=$1', [characterId]);
  }
});

pgTest('backfilled historical VK order не начисляется повторно', async () => {
  const vkUserId = 900000002;
  const characterId = await user('backfill', vkUserId, 5);
  const orderId = `vk-backfill-${Date.now()}`;
  try {
    await pool.query(`INSERT INTO vk_payments (order_id,user_id,character_id,item,status,processed_at)
      VALUES ($1,$2,$3,'silver_10000','chargeable',100)`, [orderId, vkUserId, characterId]);
    await pool.query(`INSERT INTO payment_deliveries
      (provider,external_id,provider_user_id,character_id,item,status,processed_at)
      SELECT 'vk',order_id,MAX(user_id),NULLIF(MAX(character_id),0),MAX(item),'succeeded',MAX(processed_at)
      FROM vk_payments WHERE order_id=$1 AND status='chargeable' GROUP BY order_id
      ON CONFLICT (provider,external_id) DO NOTHING`, [orderId]);
    const result = await processVkSilverPayment(createPgVkPaymentDeliveryRepository(), input(orderId, vkUserId));
    assert.equal(result.status, 'already-processed');
    assert.equal(Number((await pool.query('SELECT bank FROM users WHERE id=$1', [characterId])).rows[0].bank), 5);
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM vk_payments WHERE order_id=$1', [orderId])).rows[0].n), 1);
  } finally {
    await pool.query("DELETE FROM payment_deliveries WHERE provider='vk' AND external_id=$1", [orderId]);
    await pool.query('DELETE FROM vk_payments WHERE order_id=$1', [orderId]);
    await pool.query('DELETE FROM users WHERE id=$1', [characterId]);
  }
});

test.after(async () => { if (shouldRun) await pool.end(); });
