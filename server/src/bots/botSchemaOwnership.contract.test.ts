/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const botSource = readFileSync(resolve(__dirname, 'botManager.ts'), 'utf8');
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/botAccounts.sql'), 'utf8');

test('bot runtime uses read-only readiness, not import-time DDL', () => {
  assert.doesNotMatch(botSource, /CREATE TABLE IF NOT EXISTS bot_accounts/i);
  assert.match(botSource, /export async function initBotAccounts\(\)/);
  assert.match(botSource, /bot_accounts schema readiness failed/);
});

test('bot readiness is awaited before server listen', () => {
  assert.match(indexSource, /import \{ initBotAccounts \} from ['"]\.\/bots\/botManager['"];/);
  assert.match(indexSource, /await initBotAccounts\(\)[\s\S]*await treasuryReady[\s\S]*server\.listen/);
});

test('canonical bot schema preserves live shape and uniqueness', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS bot_accounts[\s\S]*userId INTEGER NOT NULL UNIQUE[\s\S]*token TEXT NOT NULL[\s\S]*active INTEGER DEFAULT 1[\s\S]*createdAt TEXT NOT NULL/i);
  assert.match(migrationSource, /^BEGIN;[\s\S]*CREATE TABLE IF NOT EXISTS bot_accounts[\s\S]*COMMIT;\s*$/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT, UPDATE ON bot_accounts TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE bot_accounts_id_seq TO game/i);
});
