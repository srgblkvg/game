/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schedulerSource = readFileSync(resolve(__dirname, '../schedulers/guildBossWeeklyReset.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/guildBossWeeklyState.sql'), 'utf8');

test('weekly reset scheduler не владеет table DDL при import', () => {
  assert.doesNotMatch(schedulerSource, /CREATE TABLE IF NOT EXISTS guild_boss_weekly_state/i);
  assert.doesNotMatch(schedulerSource, /initWeeklyResetState/);
  assert.match(schedulerSource, /SELECT week_start FROM guild_boss_weekly_state LIMIT 0/);
  assert.match(schedulerSource, /await assertWeeklyResetStateReady\(\)/);
});

test('canonical schema сохраняет singleton weekly reset state', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS guild_boss_weekly_state[\s\S]*id INTEGER PRIMARY KEY CHECK \(id = 1\)[\s\S]*week_start INTEGER NOT NULL/i);
});

test('migration is idempotent and preserves reset lock/state paths', () => {
  assert.match(migrationSource, /^BEGIN;/m);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS guild_boss_weekly_state/i);
  assert.match(migrationSource, /CHECK \(id = 1\)/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT, UPDATE, DELETE ON guild_boss_weekly_state TO game/i);
  assert.match(migrationSource, /COMMIT;/i);
  assert.match(schedulerSource, /pg_advisory_xact_lock/);
  assert.match(schedulerSource, /SELECT week_start FROM guild_boss_weekly_state WHERE id = 1 FOR UPDATE/);
  assert.match(schedulerSource, /UPDATE guild_boss_weekly_state SET week_start/);
});

assert.equal(typeof schedulerSource, 'string');
assert.equal(typeof schemaSource, 'string');
assert.equal(typeof migrationSource, 'string');
// No database writes are performed by this contract test.
