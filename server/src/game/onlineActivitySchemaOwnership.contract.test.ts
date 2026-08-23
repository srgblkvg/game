/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const activitySource = readFileSync(resolve(__dirname, 'onlineActivity.ts'), 'utf8');
const websocketSource = readFileSync(resolve(__dirname, '../websocket.ts'), 'utf8');
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const migrationSource = readFileSync(resolve(__dirname, '../db/migrations/onlineActivity.sql'), 'utf8');

test('online activity runtime uses read-only readiness, not DDL', () => {
  assert.doesNotMatch(activitySource, /CREATE TABLE|CREATE INDEX/i);
  assert.match(activitySource, /SELECT id, user_id, browser_session_id, platform, started_at, last_heartbeat_at, ended_at, active_seconds, end_reason FROM game_sessions LIMIT 0/);
  assert.match(activitySource, /SELECT id, session_id, user_id, path, started_at, last_seen_at, ended_at, active_seconds FROM game_page_visits LIMIT 0/);
  assert.match(activitySource, /UNIQUE \(user_id, browser_session_id\)/);
  assert.match(activitySource, /FOREIGN KEY \(session_id\) REFERENCES game_sessions\(id\) ON DELETE CASCADE/);
  for (const [index, column] of [
    ['idx_game_sessions_started', 'started_at'],
    ['idx_game_sessions_last_heartbeat', 'last_heartbeat_at'],
    ['idx_game_page_visits_started', 'started_at'],
    ['idx_game_page_visits_path', 'path'],
  ]) {
    assert.match(activitySource, new RegExp(`indexname = '${index}' AND indexdef LIKE '%\\(${column}\\)'`));
  }
  for (const table of ['game_sessions', 'game_page_visits']) {
    assert.match(activitySource, new RegExp(`has_table_privilege\\(current_user, '${table}', 'INSERT'\\)`));
    assert.match(activitySource, new RegExp(`has_table_privilege\\(current_user, '${table}', 'UPDATE'\\)`));
  }
  assert.match(activitySource, /has_sequence_privilege\(current_user, 'game_sessions_id_seq', 'USAGE'\)/);
  assert.match(activitySource, /throw new Error\('online activity schema readiness failed'\)/);
});

test('websocket setup is awaited before server listen', () => {
  assert.doesNotMatch(indexSource, /^setupWebSocket\(server\);/m);
  assert.match(indexSource, /await setupWebSocket\(server\)[\s\S]*server\.listen/);
  assert.match(websocketSource, /await initOnlineActivity\(\)[\s\S]*new WebSocketServer/);
});

test('canonical schema preserves activity relations and indexes', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS game_sessions[\s\S]*id BIGSERIAL PRIMARY KEY[\s\S]*UNIQUE \(user_id, browser_session_id\)/i);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS game_page_visits[\s\S]*session_id BIGINT NOT NULL REFERENCES game_sessions\(id\) ON DELETE CASCADE[\s\S]*active_seconds INTEGER NOT NULL DEFAULT 0/i);
  for (const index of ['idx_game_sessions_started', 'idx_game_sessions_last_heartbeat', 'idx_game_page_visits_started', 'idx_game_page_visits_path']) {
    assert.match(schemaSource, new RegExp(`CREATE INDEX IF NOT EXISTS ${index}`, 'i'));
  }
});

test('online activity migration is transactional, idempotent and grants runtime access', () => {
  assert.match(migrationSource, /^BEGIN;/m);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS game_sessions/i);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS game_page_visits/i);
  assert.match(migrationSource, /GRANT SELECT, INSERT, UPDATE, DELETE ON game_sessions, game_page_visits TO game/i);
  assert.match(migrationSource, /GRANT USAGE, SELECT ON SEQUENCE game_sessions_id_seq, game_page_visits_id_seq TO game/i);
  assert.match(migrationSource, /COMMIT;/i);
});

assert.equal(typeof activitySource, 'string');
// No database writes are performed by this contract test.
