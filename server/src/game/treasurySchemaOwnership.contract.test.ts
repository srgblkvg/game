/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const treasurySource = readFileSync(resolve(__dirname, 'treasury.ts'), 'utf8');
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/treasury.sql'), 'utf8');

test('treasury runtime uses read-only exact readiness, not DDL or seed writes', () => {
  assert.doesNotMatch(treasurySource, /CREATE TABLE|INSERT INTO castle_treasury/i);
  assert.match(treasurySource, /SELECT id, amount, updated_at FROM castle_treasury ORDER BY id/);
  assert.match(treasurySource, /SELECT id, amount, source, created_at FROM treasury_log LIMIT 0/);
  assert.match(treasurySource, /information_schema\.columns/);
  assert.match(treasurySource, /convalidated = true/);
  assert.match(treasurySource, /treasury schema readiness failed/);
});

test('treasury readiness is awaited before exchange, websocket and listen', () => {
  assert.ok(indexSource.indexOf("import { initTreasury, initTreasuryLog }") < indexSource.indexOf('const treasuryReady'));
  assert.match(indexSource, /const treasuryReady = Promise\.all\(\[initTreasury\(\), initTreasuryLog\(\)\]\)/);
  assert.match(indexSource, /await treasuryReady[\s\S]*await initExchange\(\)[\s\S]*await setupWebSocket\(server\)[\s\S]*server\.listen/);
  assert.match(indexSource, /Promise\.allSettled\(\[treasuryReady, initTournamentSchema\(\)\]\)/);
  assert.match(indexSource, /results\.every\(result => result\.status === 'fulfilled'\)/);
});

test('canonical schema preserves treasury singleton/log shape', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS castle_treasury[\s\S]*id INTEGER PRIMARY KEY DEFAULT 1 CHECK \(id = 1\)[\s\S]*amount INTEGER NOT NULL DEFAULT 0[\s\S]*updated_at TIMESTAMPTZ DEFAULT NOW\(\)/i);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS treasury_log[\s\S]*id SERIAL PRIMARY KEY[\s\S]*amount INTEGER NOT NULL[\s\S]*source TEXT NOT NULL[\s\S]*created_at TIMESTAMPTZ DEFAULT NOW\(\)/i);
});

test('treasury migration is transactional, idempotent and does not overwrite singleton', () => {
  assert.match(migrationSource, /^BEGIN;/m);
  assert.match(migrationSource, /INSERT INTO castle_treasury \(id, amount\)\s+VALUES \(1, 0\)\s+ON CONFLICT \(id\) DO NOTHING/i);
  assert.match(migrationSource, /GRANT SELECT, UPDATE ON castle_treasury TO game/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT ON treasury_log TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE treasury_log_id_seq TO game/i);
  assert.match(migrationSource, /COMMIT;/i);
});

assert.equal(typeof treasurySource, 'string');
// No database writes are performed by this contract test.
