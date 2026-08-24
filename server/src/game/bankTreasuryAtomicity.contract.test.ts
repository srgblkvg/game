/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(__dirname, '../routes/bank.ts'), 'utf8');
const operations = readFileSync(resolve(__dirname, 'bankOperations.ts'), 'utf8');

function routeBlock(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `route block not found: ${start}`);
  return source.slice(from, to);
}

const deposit = routeBlock("router.post('/bank/deposit'", "router.post('/bank/withdraw'");
const transfer = routeBlock("router.post('/bank/transfer'", "router.get('/bank/transfers'");

test('deposit mutates user, operation and treasury on one client', () => {
  assert.match(source, /import \{ depositWithClient, transferWithClient \} from '\.\.\/game\/bankOperations'/);
  assert.match(deposit, /await db\.tx\(client => depositWithClient\(client, userId, amount\)\)/);
  assert.match(operations, /depositWithClient[\s\S]*castle_treasury[\s\S]*FOR UPDATE/i);
  assert.match(operations, /depositWithClient[\s\S]*SELECT money FROM users WHERE id = \$1 FOR UPDATE/i);
  assert.match(operations, /depositWithClient[\s\S]*await changeTreasuryWithClient\(client, commission, 'bank_deposit'\)/);
  assert.doesNotMatch(deposit, /addToTreasury|\.catch\(\(\) => \{\}\)/);
  const depositOperation = operations.slice(operations.indexOf('export async function depositWithClient'), operations.indexOf('export async function transferWithClient'));
  assert.ok(depositOperation.indexOf('castle_treasury') < depositOperation.indexOf('SELECT money FROM users'));
});

test('transfer locks treasury then both users and commits commission with transfer', () => {
  assert.match(transfer, /await db\.tx\(client => transferWithClient\(client, userId, accountNumber, transferAmount\)\)/);
  assert.match(operations, /transferWithClient[\s\S]*castle_treasury[\s\S]*FOR UPDATE/i);
  assert.match(operations, /WHERE id = ANY\(\$1::int\[\]\)[\s\S]*ORDER BY id FOR UPDATE/i);
  assert.match(operations, /await changeTreasuryWithClient\(client, commission, 'bank_transfer'\)/);
  assert.doesNotMatch(transfer, /addToTreasury|\.catch\(\(\) => \{\}\)/);
  const transferOperation = operations.slice(operations.indexOf('export async function transferWithClient'));
  assert.ok(transferOperation.indexOf('castle_treasury') < transferOperation.indexOf('ORDER BY id FOR UPDATE'));
});

 test('withdraw remains commission-free and keeps its idempotency path', () => {
  const withdraw = routeBlock("router.post('/bank/withdraw'", "router.post('/bank/transfer'");
  assert.match(withdraw, /operationId/);
  assert.doesNotMatch(withdraw, /changeTreasuryWithClient|addToTreasury/);
});
