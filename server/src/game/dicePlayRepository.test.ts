/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { startDicePlayAtomic } from './dicePlayRepository';

test('repository locks user first, then active game, and performs one deduction and insert', async () => {
  const calls: string[] = [];
  const client = { async query(sql: string, params: unknown[]) {
    calls.push(sql);
    if (sql.includes('FROM users')) return { rows: [{ id: 7, money: 100 }], rowCount: 1 };
    if (sql.includes('FROM dice_games') && sql.includes('COUNT')) return { rows: [{ count: '0' }], rowCount: 1 };
    if (sql.includes('FROM dice_games')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('UPDATE users')) return { rows: [], rowCount: 1 };
    if (sql.startsWith('INSERT INTO dice_games')) return { rows: [{ id: 55 }], rowCount: 1 };
    throw new Error(`unexpected SQL: ${sql}`);
  } } as any;
  const result = await startDicePlayAtomic(client, 7, 100, new Date('2026-01-01T00:00:00Z'), () => 0);
  assert.equal(result.id, 55);
  assert.ok(calls[0]!.includes('users') && calls[0]!.includes('FOR UPDATE'));
  assert.ok(calls[1]!.includes('COUNT') && calls[1]!.includes('dice_games'));
  assert.ok(calls[2]!.includes('dice_games') && calls[2]!.includes('FOR UPDATE'));
  assert.equal(calls.filter(sql => sql.startsWith('UPDATE users')).length, 1);
  assert.equal(calls.filter(sql => sql.startsWith('INSERT INTO dice_games')).length, 1);
});

test('repository expires stale game and rechecks limit and balance under the transaction', async () => {
  const calls: string[] = [];
  const client = { async query(sql: string) {
    calls.push(sql);
    if (sql.includes('FROM users')) return { rows: [{ id: 7, money: 100 }], rowCount: 1 };
    if (sql.includes('FROM dice_games') && sql.includes('COUNT')) return { rows: [{ count: '0' }], rowCount: 1 };
    if (sql.includes('FROM dice_games')) return { rows: [{ id: 9, created_at: new Date('2026-01-01T00:00:00Z') }], rowCount: 1 };
    return { rows: [{ id: 56 }], rowCount: 1 };
  } } as any;
  await startDicePlayAtomic(client, 7, 10, new Date('2026-01-01T00:06:00Z'), () => 0);
  assert.ok(calls.some(sql => sql.includes("status = 'expired'")));
  assert.ok(calls.indexOf(calls.find(sql => sql.includes('UPDATE dice_games'))!) < calls.findIndex(sql => sql.startsWith('UPDATE users')));
});
