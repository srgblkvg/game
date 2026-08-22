/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { ensureVkPaymentDeliveryReady } from './vkPaymentDeliveryRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

pgTest('unresolved historical VK character aborts readiness and backfill', async () => {
  const orderId = `vk-unresolved-${Date.now()}`;
  try {
    await pool.query(`INSERT INTO vk_payments
      (order_id,user_id,character_id,item,status,processed_at)
      VALUES ($1,900000099,0,'silver_10000','chargeable',100)`, [orderId]);
    await assert.rejects(ensureVkPaymentDeliveryReady(), /conflicting historical VK payment identities/);
    const table = (await pool.query("SELECT to_regclass('payment_deliveries') AS name")).rows[0].name;
    assert.equal(table, null);
  } finally {
    await pool.query('DELETE FROM vk_payments WHERE order_id=$1', [orderId]);
  }
});

test.after(async () => { if (shouldRun) await pool.end(); });
