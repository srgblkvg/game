/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/guildBuildings.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');

test('guild buildings route не выполняет schema DDL при import', () => {
  assert.doesNotMatch(routeSource, /CREATE TABLE/i);
  assert.doesNotMatch(routeSource, /ALTER TABLE/i);
});

test('canonical schema сохраняет guild_buildings defaults и unique ownership constraint', () => {
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS guild_buildings[\s\S]*guildId INTEGER NOT NULL[\s\S]*buildingType TEXT NOT NULL[\s\S]*level INTEGER DEFAULT 0[\s\S]*UNIQUE\(guildId, buildingType\)/i);
});

test('guild buildings read/upgrade routes сохраняются', () => {
  assert.match(routeSource, /router\.get\('\/guild\/:guildId\/buildings'/);
  assert.match(routeSource, /router\.post\('\/guild\/:guildId\/buildings\/upgrade'/);
  assert.match(routeSource, /INSERT INTO guild_buildings/);
  assert.match(routeSource, /UPDATE guild_buildings/);
});

// No database writes are performed by this contract test.
assert.equal(typeof routeSource, 'string');
assert.equal(typeof schemaSource, 'string');
