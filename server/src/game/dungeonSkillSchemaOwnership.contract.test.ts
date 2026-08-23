/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/dungeon.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
const payoutRepositorySource = readFileSync(resolve(__dirname, 'dungeonPayoutRepository.ts'), 'utf8');

test('dungeon route не создаёт skill tables при import', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE IF NOT EXISTS skill_pages/i);
  assert.doesNotMatch(routeSource, /CREATE TABLE IF NOT EXISTS skill_levels/i);
});

test('canonical schema сохраняет skill_pages defaults и unique key', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS skill_pages[\s\S]*id SERIAL PRIMARY KEY[\s\S]*userId INTEGER NOT NULL[\s\S]*skillId INTEGER NOT NULL[\s\S]*count INTEGER DEFAULT 1[\s\S]*UNIQUE\(userId, skillId\)/i);
});

test('canonical schema сохраняет skill_levels defaults и unique key', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS skill_levels[\s\S]*userId INTEGER NOT NULL[\s\S]*skillId INTEGER NOT NULL[\s\S]*level INTEGER DEFAULT 0[\s\S]*UNIQUE\(userId, skillId\)/i);
});

test('dungeon skill read, payout upsert и upgrade paths сохраняются', () => {
  assert.match(routeSource, /SELECT count FROM skill_pages/);
  assert.match(routeSource, /UPDATE skill_pages SET count = count -/);
  assert.match(routeSource, /INSERT INTO skill_levels/);
  assert.match(routeSource, /ON CONFLICT \(userId, skillId\) DO UPDATE SET level/);
  assert.match(routeSource, /router\.post\('\/dungeon\/upgrade-skill'/);
  assert.match(payoutRepositorySource, /INSERT INTO skill_pages[\s\S]*ON CONFLICT \(userid, skillid\) DO UPDATE SET count/);
});

// No database writes are performed by this contract test.
assert.equal(typeof routeSource, 'string');
assert.equal(typeof schemaSource, 'string');
assert.equal(typeof payoutRepositorySource, 'string');
