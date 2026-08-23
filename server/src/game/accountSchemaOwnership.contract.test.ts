/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const accountSource = readFileSync(resolve(__dirname, '../routes/account.ts'), 'utf8');
const schemaSource = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');

test('account route не выполняет ownership DDL', () => {
  assert.doesNotMatch(accountSource, /ALTER TABLE users/i);
  assert.doesNotMatch(accountSource, /CREATE TABLE/i);
});

test('canonical users schema объявляет expEnabled с default true', () => {
  assert.match(schemaSource, /\bexpEnabled\s+BOOLEAN\s+DEFAULT\s+TRUE\b/i);
});

test('account setting сохраняет прежний read/write API', () => {
  assert.match(accountSource, /router\.get\('\/account\/experience-setting'/);
  assert.match(accountSource, /router\.post\('\/account\/experience-setting'/);
  assert.match(accountSource, /SELECT expEnabled FROM users/);
  assert.match(accountSource, /UPDATE users SET expEnabled = \?/);
});

// No database writes are performed by this contract test.
assert.equal(typeof accountSource, 'string');
assert.equal(typeof schemaSource, 'string');
