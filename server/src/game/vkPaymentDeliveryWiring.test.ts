/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = () => readFileSync(resolve(__dirname, '../routes/vkPayments.ts'), 'utf8');
const branch = () => {
  const body = source();
  const start = body.indexOf("if (status === 'chargeable')");
  const end = body.indexOf("if (status === 'refunded')", start);
  assert.ok(start >= 0 && end > start);
  return body.slice(start, end);
};

test('подпись проверяется fail-closed до payment callback', () => {
  const body = source();
  assert.match(body, /if \(!sig \|\| !APP_SECRET\) return false/);
  assert.ok(body.indexOf('if (!verifySignature(params))') < body.indexOf("if (status === 'chargeable')"));
});

test('VK silver использует atomic ledger service и не вызывает deliverSilver', () => {
  const body = branch();
  const silverStart = body.indexOf("item.type === 'silver'");
  const silverEnd = body.indexOf("} else if", silverStart);
  assert.ok(silverStart >= 0 && silverEnd > silverStart);
  const silver = body.slice(silverStart, silverEnd);
  assert.match(silver, /processVkSilverPayment\(createPgVkPaymentDeliveryRepository\(\)/);
  assert.match(silver, /providerPrice:\s*Number\(params\.item_price\)/);
  assert.doesNotMatch(silver, /item_price \|\||deliverSilver|db\.run\(/);
});

test('callback создаёт shared read-only readiness до chargeable', () => {
  const body = source();
  const readiness = body.indexOf('export const vkPaymentsReady = ensureVkPaymentDeliveryReady()');
  const awaited = body.indexOf('await vkPaymentsReady');
  const chargeable = body.indexOf("if (status === 'chargeable')");
  assert.ok(readiness >= 0 && awaited > readiness && chargeable > awaited);
  assert.match(body, /export const vkPaymentsReady/);
  assert.match(body, /await vkPaymentsReady/);
});

test('server ждёт VK payment readiness до listen и завершает процесс при reject', () => {
  const index = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
  assert.ok(index.indexOf('await vkPaymentsReady') < index.indexOf('server.listen'));
  assert.match(index, /startServer\(\)\.catch[\s\S]*process\.exit\(1\)/);
});

test('migration создаёт unique ledger и backfill chargeable до route activation', () => {
  const migration = readFileSync(resolve(__dirname, '../db/migrations/vkPayments.sql'), 'utf8');
  assert.match(migration, /UNIQUE\s*\(provider,\s*external_id\)/i);
  assert.match(migration, /INSERT INTO payment_deliveries[\s\S]*SELECT[\s\S]*FROM vk_payments[\s\S]*status = 'chargeable'/i);
  assert.match(migration, /COUNT\(DISTINCT user_id\)[\s\S]*COUNT\(DISTINCT item\)/i);
  assert.match(migration, /character_id IS NULL OR character_id <= 0/i);
  assert.match(migration, /RAISE EXCEPTION 'conflicting historical VK payment identities/i);
  assert.match(migration, /ON CONFLICT \(provider, external_id\) DO NOTHING/i);
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /COMMIT;/);
});

test('post-commit VK notification использует delivered characterId', () => {
  const body = branch();
  const delivery = body.indexOf('await processVkSilverPayment(');
  assert.ok(delivery >= 0);
  assert.ok(body.indexOf('sendToUser(result.characterId', delivery) > delivery);
});
