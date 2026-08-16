/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adjustedStreakChance,
  createBattleRngState,
  resolveStreakRoll,
  rollCriticalBaseDamage,
} from './battle';

test('каждый последовательный успех снижает шанс события на 20 процентов', () => {
  assert.equal(adjustedStreakChance(0.4, 0), 0.4);
  assert.ok(Math.abs(adjustedStreakChance(0.4, 1) - 0.32) < 1e-12);
  assert.ok(Math.abs(adjustedStreakChance(0.4, 2) - 0.256) < 1e-12);
});

test('шанс серии не падает ниже четверти исходного шанса', () => {
  assert.equal(adjustedStreakChance(0.4, 20), 0.1);
});

test('успех продолжает серию, а неудача сбрасывает её', () => {
  const success = resolveStreakRoll(0.4, 1, 0.2);
  assert.equal(success.success, true);
  assert.equal(success.nextStreak, 2);
  assert.ok(Math.abs(success.chance - 0.32) < 1e-12);

  const failure = resolveStreakRoll(0.4, 2, 0.9);
  assert.equal(failure.success, false);
  assert.equal(failure.nextStreak, 0);
  assert.ok(Math.abs(failure.chance - 0.256) < 1e-12);
});

test('базовый критический урон всегда не ниже среднего между уровнем и силой', () => {
  const stats = { s: 50 } as any;
  assert.equal(rollCriticalBaseDamage(stats, 10, () => 0), 30);
  assert.equal(rollCriticalBaseDamage(stats, 10, () => 1), 50);
});

test('серии атакующего и защитника хранятся независимо', () => {
  const actorRng = createBattleRngState();
  const targetRng = createBattleRngState();
  actorRng.streaks.crit = 2;
  targetRng.streaks.dodge = 3;

  assert.equal(actorRng.streaks.dodge, 0);
  assert.equal(targetRng.streaks.crit, 0);
  assert.equal(actorRng.streaks.crit, 2);
  assert.equal(targetRng.streaks.dodge, 3);
});
