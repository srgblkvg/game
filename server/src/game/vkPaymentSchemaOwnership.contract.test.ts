/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/vkPayments.ts'), 'utf8');
const repositorySource = readFileSync(resolve(__dirname, 'vkPaymentDeliveryRepository.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationPath = resolve(__dirname, '../db/migrations/vkPayments.sql');
const migrationSource = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
const legacyMigrationSource = readFileSync(resolve(__dirname, '../scripts/migrate-vk-payment-deliveries.ts'), 'utf8');
const pgReadinessSource = readFileSync(resolve(__dirname, 'vkPaymentReadiness.pg.test.ts'), 'utf8');

test('VK runtime uses read-only exact readiness without schema or backfill writes', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE IF NOT EXISTS vk_payments/i);
  assert.doesNotMatch(repositorySource, /CREATE TABLE IF NOT EXISTS payment_deliveries/i);
  assert.doesNotMatch(repositorySource, /INSERT INTO payment_deliveries[\s\S]*SELECT 'vk'/i);
  assert.match(repositorySource, /information_schema\.columns/);
  assert.match(repositorySource, /vk_payments schema readiness failed/);
  assert.match(repositorySource, /payment_deliveries schema readiness failed/);
  assert.match(repositorySource, /conflicting historical VK payment identities/);
  assert.match(repositorySource, /missing historical VK payment deliveries/);
  assert.match(repositorySource, /conflicting VK payment delivery identities/);
  assert.match(repositorySource, /conflicting VK payment delivery terminal state/);
});

test('VK readiness remains shared by startup and callbacks', () => {
  assert.match(routeSource, /export const vkPaymentsReady = ensureVkPaymentDeliveryReady\(\)/);
  assert.match(routeSource, /await vkPaymentsReady[\s\S]*if \(status === 'chargeable'\)/);
  assert.match(indexSource, /await Promise\.all\(\[vkPaymentsReady, yooKassaPaymentsReady\]\)[\s\S]*server\.listen/);
});

test('canonical VK payment schema preserves exact live-compatible shapes', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS vk_payments[\s\S]*id SERIAL PRIMARY KEY[\s\S]*order_id TEXT NOT NULL[\s\S]*user_id INTEGER NOT NULL[\s\S]*character_id INTEGER NOT NULL DEFAULT 0[\s\S]*item TEXT NOT NULL[\s\S]*status TEXT NOT NULL[\s\S]*processed_at INTEGER NOT NULL[\s\S]*created_at TIMESTAMP DEFAULT NOW\(\)/i);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS payment_deliveries[\s\S]*id BIGSERIAL PRIMARY KEY[\s\S]*provider TEXT NOT NULL[\s\S]*external_id TEXT NOT NULL[\s\S]*provider_user_id BIGINT NOT NULL[\s\S]*character_id INTEGER[\s\S]*item TEXT NOT NULL[\s\S]*status TEXT NOT NULL[\s\S]*processed_at BIGINT[\s\S]*created_at TIMESTAMP DEFAULT NOW\(\)[\s\S]*UNIQUE \(provider, external_id\)/i);
});

test('VK migration is transactional, detects conflicts and backfills once', () => {
  assert.match(migrationSource, /^BEGIN;/m);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS vk_payments/i);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS payment_deliveries/i);
  assert.match(migrationSource, /RAISE EXCEPTION 'conflicting historical VK payment identities/i);
  assert.match(migrationSource, /INSERT INTO payment_deliveries[\s\S]*SELECT\s+'vk'[\s\S]*FROM vk_payments[\s\S]*status = 'chargeable'[\s\S]*ON CONFLICT \(provider, external_id\) DO NOTHING/i);
  assert.match(migrationSource, /RAISE EXCEPTION 'conflicting VK payment delivery identities/i);
  assert.match(migrationSource, /RAISE EXCEPTION 'conflicting VK payment delivery terminal state/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT ON vk_payments TO game/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT, UPDATE ON payment_deliveries TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE vk_payments_id_seq TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE payment_deliveries_id_seq TO game/i);
  assert.match(migrationSource, /COMMIT;/);
});

test('legacy migration entrypoint cannot mutate schema or ledger', () => {
  assert.doesNotMatch(legacyMigrationSource, /pool\.connect|CREATE TABLE|INSERT INTO|BEGIN|COMMIT/i);
  assert.match(legacyMigrationSource, /vkPayments\.sql/);
});

test('PG readiness test expects pre-existing schema and no runtime backfill', () => {
  assert.doesNotMatch(pgReadinessSource, /assert\.equal\(table, null\)/);
  assert.match(pgReadinessSource, /assert\.notEqual\(table, null\)/);
  assert.match(pgReadinessSource, /SELECT COUNT\(\*\).*payment_deliveries/is);
});
