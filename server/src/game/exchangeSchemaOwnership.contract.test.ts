/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const exchangeSource = readFileSync(resolve(__dirname, 'exchange.ts'), 'utf8');
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/exchange.sql'), 'utf8');

test('exchange runtime uses read-only readiness, not schema DDL or seed writes', () => {
  assert.doesNotMatch(exchangeSource, /CREATE TABLE|INSERT INTO exchange_gold/i);
  assert.match(exchangeSource, /SELECT id, amount, updated_at FROM exchange_gold ORDER BY id/);
  assert.match(exchangeSource, /SELECT id, price, silver, gold, created_at FROM exchange_history LIMIT 0/);
  assert.match(exchangeSource, /CHECK \(\(id = 1\)\)/);
  assert.match(exchangeSource, /convalidated = true/);
  assert.match(exchangeSource, /reserve\.rowCount !== 1 \|\| Number\(reserve\.rows\[0\]\?\.id\) !== 1/);
  assert.match(exchangeSource, /information_schema\.columns/);
  assert.match(exchangeSource, /\["id", "integer", "NO", "1"\]/);
  assert.match(exchangeSource, /nextval\(''exchange_history_id_seq''::regclass\)/);
  assert.match(exchangeSource, /PRIMARY KEY \(id\)/);
  assert.match(exchangeSource, /has_table_privilege\(current_user, 'exchange_gold', 'UPDATE'\)/);
  assert.match(exchangeSource, /has_table_privilege\(current_user, 'exchange_history', 'INSERT'\)/);
  assert.match(exchangeSource, /has_sequence_privilege\(current_user, 'exchange_history_id_seq', 'USAGE'\)/);
  assert.match(exchangeSource, /exchange schema readiness failed/);
});

test('exchange readiness is awaited before websocket and listen', () => {
  assert.match(indexSource, /await initExchange\(\)[\s\S]*await setupWebSocket\(server\)[\s\S]*server\.listen/);
  assert.doesNotMatch(indexSource, /Promise\.allSettled\(\[[^\]]*initExchange\(/);
});

test('canonical schema preserves exchange singleton/history shape', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS exchange_gold[\s\S]*id INTEGER PRIMARY KEY DEFAULT 1 CHECK \(id = 1\)[\s\S]*amount INTEGER NOT NULL DEFAULT 0[\s\S]*updated_at TIMESTAMPTZ DEFAULT NOW\(\)/i);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS exchange_history[\s\S]*id SERIAL PRIMARY KEY[\s\S]*price INTEGER NOT NULL[\s\S]*silver INTEGER NOT NULL[\s\S]*gold INTEGER NOT NULL[\s\S]*created_at TIMESTAMPTZ DEFAULT NOW\(\)/i);
});

test('exchange migration is transactional, idempotent and seeds only missing singleton row', () => {
  assert.match(migrationSource, /^BEGIN;/m);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS exchange_gold/i);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS exchange_history/i);
  assert.match(migrationSource, /INSERT INTO exchange_gold \(id, amount\)\s+VALUES \(1, 28000\)\s+ON CONFLICT \(id\) DO NOTHING/i);
  assert.match(migrationSource, /GRANT SELECT, UPDATE ON exchange_gold TO game/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT ON exchange_history TO game/i);
  assert.match(migrationSource, /COMMIT;/i);
});

assert.equal(typeof exchangeSource, 'string');
// No database writes are performed by this contract test.
