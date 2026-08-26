/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { finishDiceReroll } from './diceRerollRepository';

test('reroll repository locks user then game and updates one active game', async () => {
  const calls: string[] = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      calls.push(`${sql}|${JSON.stringify(params)}`);
      if (sql.startsWith('SELECT id FROM users')) return { rowCount: 1, rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, user_id')) return { rowCount: 1, rows: [{ id: 9, user_id: 7, dice: '[1,2,3,4,5]', rerolls: 0, status: 'active' }] };
      if (sql.startsWith('UPDATE dice_games')) return { rowCount: 1, rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    },
  };

  const result = await finishDiceReroll(client as never, 7, 9, [0, 2], () => 0);
  assert.deepEqual(result, { dice: [1, 1, 3, 1, 1], rerollsUsed: 1, maxRerolls: 2 });
  assert.match(calls[0]!, /users.*FOR UPDATE/);
  assert.match(calls[1]!, /dice_games.*FOR UPDATE/);
  assert.match(calls[2]!, /status = 'active'/);
});

export {};
