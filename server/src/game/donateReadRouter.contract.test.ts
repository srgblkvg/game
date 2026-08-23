/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const body = readFileSync(resolve(__dirname, '../routes/donate.ts'), 'utf8');

test('donate router exposes only starter status and preview reads', () => {
  const routes = [...body.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)]
    .map(match => `${match[1]} ${match[2]}`);
  assert.deepEqual(routes, [
    'get /starter-pack/status',
    'get /starter-pack/preview',
  ]);
  assert.doesNotMatch(body, /export async function deliver|UPDATE\s+users|INSERT\s+INTO|DELETE\s+FROM|ALTER\s+TABLE/i);
  assert.doesNotMatch(body, /sendToUser|Date\.now\(\)\s*\+\s*Math\.random/);
});

test('starter preview keeps all slots and essence count contract', () => {
  for (const slot of ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt']) {
    assert.match(body, new RegExp(`['"]${slot}['"]`));
  }
  assert.match(body, /Эссенция мрака/);
  assert.match(body, /count:\s*4/);
});
