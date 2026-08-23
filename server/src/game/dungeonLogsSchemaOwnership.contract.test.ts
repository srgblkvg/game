/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/dungeon.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/dungeonLogs.sql'), 'utf8');

test('dungeon route логирует баланс, но не владеет dungeon_logs DDL', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE IF NOT EXISTS dungeon_logs/i);
  assert.match(routeSource, /INSERT INTO dungeon_logs/);
  assert.match(routeSource, /console\.error\('\[dungeon_logs\]'/);
});

test('canonical schema содержит exact dungeon_logs balance shape', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS dungeon_logs[\s\S]*id SERIAL PRIMARY KEY[\s\S]*userId INTEGER[\s\S]*floor INTEGER[\s\S]*playerHp INTEGER[\s\S]*playerMaxHp INTEGER[\s\S]*playerStr INTEGER[\s\S]*playerAgi INTEGER[\s\S]*playerDef INTEGER[\s\S]*playerMag INTEGER[\s\S]*enemies JSONB[\s\S]*startedAt INTEGER[\s\S]*endedAt INTEGER[\s\S]*result TEXT[\s\S]*combatLog JSONB/i);
});

test('dungeon_logs migration is idempotent and grants runtime access', () => {
  assert.match(migrationSource, /^BEGIN;/m);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS dungeon_logs/i);
  assert.match(migrationSource, /enemies JSONB/i);
  assert.match(migrationSource, /combatLog JSONB/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT, UPDATE, DELETE ON dungeon_logs TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE dungeon_logs_id_seq TO game/i);
  assert.match(migrationSource, /COMMIT;/i);
});

// No database writes are performed by this contract test.
assert.equal(typeof routeSource, 'string');
assert.equal(typeof schemaSource, 'string');
assert.equal(typeof migrationSource, 'string');
