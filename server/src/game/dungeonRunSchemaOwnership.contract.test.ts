/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/dungeon.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const payoutRepositorySource = readFileSync(resolve(__dirname, 'dungeonPayoutRepository.ts'), 'utf8');

test('dungeon route не выполняет dungeon_runs DDL при import', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE IF NOT EXISTS dungeon_runs/i);
  assert.doesNotMatch(routeSource, /ALTER TABLE dungeon_runs/i);
});

test('canonical schema сохраняет dungeon_runs progress и checkpoint shape', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS dungeon_runs[\s\S]*userId INTEGER NOT NULL UNIQUE[\s\S]*currentFloor INTEGER DEFAULT 1[\s\S]*checkpointFloor INTEGER DEFAULT 0[\s\S]*enemyData TEXT NOT NULL DEFAULT '\[\]'[\s\S]*playerHp INTEGER NOT NULL[\s\S]*playerMaxHp INTEGER NOT NULL[\s\S]*role TEXT NOT NULL DEFAULT 'warrior'[\s\S]*skills TEXT NOT NULL DEFAULT '\[\]'[\s\S]*startedAt INTEGER NOT NULL[\s\S]*dailyRuns INTEGER DEFAULT 0[\s\S]*dailyRunDate TEXT DEFAULT ''[\s\S]*maxfloor INTEGER DEFAULT 0[\s\S]*maxreward INTEGER DEFAULT 0/i);
});

test('checkpoint, run start и atomic payout progress paths сохраняются', () => {
  assert.match(routeSource, /INSERT INTO dungeon_runs/);
  assert.match(routeSource, /checkpointFloor/);
  assert.match(routeSource, /UPDATE dungeon_runs SET startedAt/);
  assert.match(routeSource, /router\.post\('\/dungeon\/start'/);
  assert.match(payoutRepositorySource, /UPDATE dungeon_runs[\s\S]*maxfloor = GREATEST\(maxfloor/);
  assert.match(payoutRepositorySource, /maxreward = GREATEST\(maxreward/);
});

// No database writes are performed by this contract test.
assert.equal(typeof routeSource, 'string');
assert.equal(typeof schemaSource, 'string');
assert.equal(typeof payoutRepositorySource, 'string');
