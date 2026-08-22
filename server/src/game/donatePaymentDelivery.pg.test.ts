/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { processYooKassaSilverPayment } from './donatePaymentDelivery';
import { createPgDonatePaymentDeliveryRepository } from './donatePaymentDeliveryRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

async function fixture(label: string, bank: number | null) {
  const userId = Number((await pool.query(
    `INSERT INTO users (username, passwordhash, bank) VALUES ($1, 'test', $2) RETURNING id`,
    [`donate-payment-${label}-${Date.now()}-${Math.random()}`, bank],
  )).rows[0].id);
  const paymentId = `pay-${label}-${Date.now()}-${Math.random()}`;
  await pool.query(
    `INSERT INTO yukassa_payments (payment_id, user_id, item, days, amount, status, processed_at)
     VALUES ($1, $2, 'silver_10000', 0, '49.00', 'pending', 1)`,
    [paymentId, userId],
  );
  return { userId, paymentId };
}

async function cleanup(data: { userId: number; paymentId: string } | null) {
  if (!data) return;
  await pool.query('DELETE FROM yukassa_payments WHERE payment_id=$1', [data.paymentId]);
  await pool.query('DELETE FROM users WHERE id=$1', [data.userId]);
}

function input(data: { userId: number; paymentId: string }) {
  return {
    paymentId: data.paymentId,
    providerUserId: String(data.userId),
    providerItem: 'silver_10000',
    verifiedAmount: '49.00',
    verifiedCurrency: 'RUB',
    processedAt: 1234,
  };
}

pgTest('два параллельных process дают один bank increment', async () => {
  let data: Awaited<ReturnType<typeof fixture>> | null = null;
  try {
    data = await fixture('parallel', 5);
    const results = await Promise.all([
      processYooKassaSilverPayment(createPgDonatePaymentDeliveryRepository(), input(data)),
      processYooKassaSilverPayment(createPgDonatePaymentDeliveryRepository(), input(data)),
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), ['already-processed', 'delivered']);
    const user = (await pool.query('SELECT bank FROM users WHERE id=$1', [data.userId])).rows[0];
    const payment = (await pool.query('SELECT status FROM yukassa_payments WHERE payment_id=$1', [data.paymentId])).rows[0];
    assert.equal(Number(user.bank), 10005);
    assert.equal(payment.status, 'succeeded');
  } finally { await cleanup(data); }
});

pgTest('ошибка marking succeeded откатывает bank', async () => {
  let data: Awaited<ReturnType<typeof fixture>> | null = null;
  try {
    data = await fixture('rollback', 5);
    const repository = createPgDonatePaymentDeliveryRepository({ failMarkSucceeded: true });
    await assert.rejects(processYooKassaSilverPayment(repository, input(data)), /forced mark succeeded failure/);
    const user = (await pool.query('SELECT bank FROM users WHERE id=$1', [data.userId])).rows[0];
    const payment = (await pool.query('SELECT status FROM yukassa_payments WHERE payment_id=$1', [data.paymentId])).rows[0];
    assert.equal(Number(user.bank), 5);
    assert.equal(payment.status, 'pending');
  } finally { await cleanup(data); }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
