/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { DiceGameNotActiveError } from './diceFinish';
import { finishDiceAtomic, finishDiceGame } from './diceFinishRepository';

function fakeClient(options: { active?: boolean; failGameUpdate?: boolean } = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id FROM users')) return { rows: [{ id: 7 }], rowCount: 1 };
      if (sql.startsWith('SELECT id, user_id')) {
        return options.active === false
          ? { rows: [{ id: 9, user_id: 7, entry_fee: 10, dice: '[6,6,6,6,6]', status: 'finished' }], rowCount: 1 }
          : { rows: [{ id: 9, user_id: 7, entry_fee: 10, dice: '[6,6,6,6,6]', status: 'active' }], rowCount: 1 };
      }
      if (sql.includes('UPDATE dice_games')) return { rows: [], rowCount: options.failGameUpdate ? 0 : 1 };
      return { rows: [], rowCount: 1 };
    },
  } as any;
  return { client, calls };
}

test('atomic finish locks user before game and writes one user result before finishing game', async () => {
  const { client, calls } = fakeClient();
  const result = await finishDiceAtomic(client, 7, 9);
  assert.equal(result.response.payout, 1000);
  assert.match(calls[0]!.sql, /users[\s\S]*FOR UPDATE/);
  assert.match(calls[1]!.sql, /dice_games[\s\S]*FOR UPDATE/);
  assert.equal(calls.filter(call => call.sql.includes('UPDATE users')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('UPDATE dice_games')).length, 1);
  assert.deepEqual(calls[2]!.params, [1000, 1, 1000, 10, 7]);
});

test('already finished game fails before payout or statistics writes', async () => {
  const { client, calls } = fakeClient({ active: false });
  await assert.rejects(finishDiceAtomic(client, 7, 9), DiceGameNotActiveError);
  assert.equal(calls.some(call => call.sql.includes('UPDATE users')), false);
  assert.equal(calls.some(call => call.sql.includes('UPDATE dice_games')), false);
});

test('lost active transition fails the surrounding transaction', async () => {
  const { client } = fakeClient({ failGameUpdate: true });
  await assert.rejects(finishDiceAtomic(client, 7, 9), DiceGameNotActiveError);
});

test('route wrapper returns the exact legacy flat response only', async () => {
  const response = { dice: [6, 6, 6, 6, 6], combo: 'poker', comboName: 'Покер', payout: 1000, profit: 990 };
  const repository = {
    async finish() {
      return { response, casino: { gamesPlayed: 1, won: 1000, lost: 10 }, gameId: 9, userId: 7 };
    },
  } as any;
  assert.deepEqual(await finishDiceGame(repository, { userId: 7, gameId: 9 }), response);
});

assert.equal(typeof finishDiceAtomic, 'function');
