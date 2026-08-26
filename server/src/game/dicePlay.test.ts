/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { playDice, type DicePlayRepository, type DicePlayTransaction } from './dicePlay';

function repository(state: Partial<{
  today: number;
  active: any;
  money: number;
}> = {}): { repo: DicePlayRepository; tx: DicePlayTransaction; calls: string[] } {
  const calls: string[] = [];
  const data = { today: 0, active: null, money: 100, ...state };
  const tx: DicePlayTransaction = {
    async lockUser(userId) { calls.push(`user:${userId}`); return { id: userId, money: data.money }; },
    async lockActiveGame(userId) { calls.push(`game:${userId}`); return data.active; },
    async countTodayGames() { calls.push('count'); return data.today; },
    async expireGame(gameId) { calls.push(`expire:${gameId}`); if (data.active) data.active = null; },
    async deductMoney(_userId, amount) { calls.push(`deduct:${amount}`); data.money -= amount; },
    async insertGame(input) { calls.push('insert'); return { id: 42, ...input }; },
  };
  const repo: DicePlayRepository = { transaction: callback => callback(tx) };
  return { repo, tx, calls };
}

test('play uses allowed bet, rolls five dice, and returns the legacy response shape', async () => {
  const { repo } = repository();
  const result = await playDice(repo, { userId: 7, bet: 999, now: new Date('2026-01-01T00:00:00Z'), random: () => 0 });
  assert.deepEqual(result, { gameId: 42, dice: [1, 1, 1, 1, 1], rerollsUsed: 0, maxRerolls: 2, entryFee: 10 });
});

test('active game at five minutes is rejected with exact legacy error', async () => {
  const { repo } = repository({ active: { id: 9, createdAt: new Date('2026-01-01T00:00:00Z') } });
  await assert.rejects(() => playDice(repo, { userId: 7, bet: 10, now: new Date('2026-01-01T00:05:00Z') }), /У вас уже есть активная игра/);
});

test('stale active game is expired before balance check and new game', async () => {
  const { repo, calls } = repository({ active: { id: 9, createdAt: new Date('2026-01-01T00:00:00Z') } });
  await playDice(repo, { userId: 7, bet: 100, now: new Date('2026-01-01T00:05:00.001Z'), random: () => .99 });
  assert.deepEqual(calls.slice(0, 4), ['user:7', 'count', 'game:7', 'expire:9']);
  assert.ok(calls.includes('deduct:100'));
  assert.ok(calls.includes('insert'));
});

test('daily limit and balance are checked transactionally', async () => {
  const daily = repository({ today: 10 });
  await assert.rejects(() => playDice(daily.repo, { userId: 7, bet: 10 }), /Дневной лимит исчерпан/);
  const poor = repository({ money: 9 });
  await assert.rejects(() => playDice(poor.repo, { userId: 7, bet: 10 }), /Недостаточно серебра/);
});

test('non-allowed bets normalize to ten while 100 and 1000 remain exact', async () => {
  for (const bet of [100, 1000]) {
    const { repo } = repository({ money: 2000 });
    const result = await playDice(repo, { userId: 7, bet, random: () => 0 });
    assert.equal(result.entryFee, bet);
  }
});
