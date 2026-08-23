/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const treasurySource = readFileSync(resolve(__dirname, 'treasury.ts'), 'utf8');

test('treasury balance and audit log use one transaction boundary', () => {
  assert.match(treasurySource, /async function changeTreasury[\s\S]*return db\.tx\(async client =>[\s\S]*await changeTreasuryWithClient\(client, delta, source\)/);
  assert.match(treasurySource, /export async function changeTreasuryWithClient\(client: PoolClient, delta: number, source: string\)/);
  assert.match(treasurySource, /UPDATE castle_treasury SET amount = amount \+ \$1[\s\S]*RETURNING amount/);
  assert.match(treasurySource, /INSERT INTO treasury_log \(amount, source, created_at\) VALUES \(\$1, \$2, NOW\(\)\)/);
  assert.match(treasurySource, /if \(update\.rowCount !== 1\)[\s\S]*throw new Error\('treasury singleton row missing'\)/);
});

test('public add/deduct helpers delegate signed deltas to atomic boundary', () => {
  assert.match(treasurySource, /export async function addToTreasury[\s\S]*return changeTreasury\(amount, source\)/);
  assert.match(treasurySource, /export async function deductFromTreasury[\s\S]*return changeTreasury\(-amount, source\)/);
});

assert.equal(typeof treasurySource, 'string');
// No database writes are performed by this contract test.
