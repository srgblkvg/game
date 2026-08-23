/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/yukassa.ts'), 'utf8');
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/yukassaPayments.sql'), 'utf8');

test('YooKassa runtime readiness is read-only and fail-closed', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE IF NOT EXISTS yukassa_payments|ALTER TABLE yukassa_payments|CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx/i);
  assert.match(routeSource, /export const yooKassaPaymentsReady = initYooKassaPaymentsReadiness\(\)/);
  assert.match(routeSource, /yukassa_payments schema readiness failed/);
  assert.match(routeSource, /await yooKassaPaymentsReady/);
});

test('YooKassa readiness is awaited before listen', () => {
  assert.match(indexSource, /await Promise\.all\(\[vkPaymentsReady, yooKassaPaymentsReady\]\)[\s\S]*server\.listen/);
});

test('canonical YooKassa schema preserves exact live-compatible shape', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS yukassa_payments[\s\S]*payment_id TEXT NOT NULL[\s\S]*days INTEGER NOT NULL[\s\S]*status TEXT NOT NULL DEFAULT 'pending'[\s\S]*item TEXT DEFAULT 'premium'[\s\S]*CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx/i);
  assert.doesNotMatch(schemaSource, /item TEXT NOT NULL DEFAULT 'premium'/i);
});

test('YooKassa migration is transactional, idempotent and grants runtime privileges', () => {
  assert.match(migrationSource, /^BEGIN;[\s\S]*CREATE TABLE IF NOT EXISTS yukassa_payments[\s\S]*CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx[\s\S]*COMMIT;\s*$/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT, UPDATE ON yukassa_payments TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE yukassa_payments_id_seq TO game/i);
});
