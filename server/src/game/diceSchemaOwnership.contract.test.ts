/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/dice.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');

test('dice route не выполняет schema DDL при import', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE/i);
  assert.doesNotMatch(routeSource, /ALTER TABLE/i);
});

test('canonical schema содержит production-shaped dice_games', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS dice_games[\s\S]*entry_fee INTEGER NOT NULL DEFAULT 10[\s\S]*dice TEXT NOT NULL DEFAULT '\[\]'[\s\S]*created_at TIMESTAMPTZ DEFAULT NOW\(\)/i);
});

test('dice status и mutation routes сохраняются', () => {
  assert.match(routeSource, /router\.get\('\/dice\/status'/);
  assert.match(routeSource, /router\.post\('\/dice\/play'/);
  assert.match(routeSource, /router\.post\('\/dice\/reroll'/);
});

// No database writes are performed by this contract test.
assert.equal(typeof routeSource, 'string');
assert.equal(typeof schemaSource, 'string');
