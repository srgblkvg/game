/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = () => readFileSync(resolve(__dirname, '../routes/yukassa.ts'), 'utf8');

function succeededBranch(): string {
  const body = source();
  const start = body.indexOf("if (event === 'payment.succeeded')");
  const end = body.indexOf("} else if (event === 'payment.canceled')", start);
  assert.ok(start >= 0 && end > start);
  return body.slice(start, end);
}

test('payment.succeeded silver использует atomic service после provider verification', () => {
  const body = succeededBranch();
  const verification = body.indexOf('yoo.payments.load(paymentId)');
  const delivery = body.indexOf('processYooKassaSilverPayment(');
  assert.ok(verification >= 0 && delivery > verification);
  assert.match(body, /createPgDonatePaymentDeliveryRepository\(\)/);
});

test('silver branch исключает legacy processDelivery и legacy deliverSilver', () => {
  const body = succeededBranch();
  const silverStart = body.indexOf("localItem.type === 'silver'");
  const silverEnd = body.indexOf('} else {', silverStart);
  assert.ok(silverStart >= 0 && silverEnd > silverStart);
  const silver = body.slice(silverStart, silverEnd);
  assert.doesNotMatch(silver, /processDelivery|deliverSilver/);
});

test('unknown payment item fails closed instead of using legacy processDelivery', () => {
  const body = succeededBranch();
  assert.doesNotMatch(body, /processDelivery\(/);
  assert.match(body, /Unsupported payment item/);
});

test('post-commit notification и email находятся после atomic delivery await', () => {
  const body = succeededBranch();
  const delivery = body.indexOf('await processYooKassaSilverPayment(');
  assert.ok(body.indexOf('sendToUser(', delivery) > delivery);
  assert.ok(body.indexOf('sendPaymentReceipt(', delivery) > delivery);
});

test('runtime DDL и migration содержат unique payment_id index', () => {
  assert.match(source(), /CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx[\s\S]*ON yukassa_payments \(payment_id\)/i);
  const migration = readFileSync(resolve(__dirname, '../scripts/migrate-yukassa-payment-id-unique.ts'), 'utf8');
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx[\s\S]*ON yukassa_payments \(payment_id\)/i);
});

test('YooKassa readiness ожидается callback и server startup fail-fast', () => {
  const body = source();
  assert.match(body, /export const yooKassaPaymentsReady/);
  assert.match(body, /await yooKassaPaymentsReady/);
  const readiness = body.slice(body.indexOf('const yooKassaPaymentsTableReady'), body.indexOf('// Товары'));
  assert.doesNotMatch(readiness, /\.catch\(/);

  const index = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
  assert.match(index, /import \{ yooKassaPaymentsReady \} from '\.\/routes\/yukassa'/);
  assert.ok(index.indexOf('await Promise.all([vkPaymentsReady, yooKassaPaymentsReady])') < index.indexOf('server.listen'));
  assert.match(index, /startServer\(\)\.catch[\s\S]*process\.exit\(1\)/);
});
