/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adjustedStreakChance,
  createBattleRngState,
  resolveStreakRoll,
  rollCriticalBaseDamage,
  runTurn,
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

test('anti-статы подавляют все соответствующие события цели', () => {
  const steps: any[] = [];
  const stats: any = {
    s: 20, a: 20, d: 20, m: 20, hp: 120,
    extra: { crit: 1000000, dodge: 1000000, counter: 1000000, fullBlock: 1000000 },
  };
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    runTurn({
      actorName: 'A', targetName: 'D', actorStats: stats, targetStats: stats,
      actorLevel: 5, hpActor: 120, hpTarget: 120, maxHpActor: 120, maxHpTarget: 120,
      actor: 'attacker', target: 'defender',
      antiDodge: 100, antiBlock: 100, antiCounter: 100,
      targetAntiCrit: 100,
    } as any, step => steps.push(step));
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(steps.some(step => step.type === 'dodge'), false);
  assert.equal(steps.some(step => step.type === 'block'), false);
  assert.equal(steps.some(step => step.type === 'fullBlock'), false);
  assert.equal(steps.some(step => step.type === 'crit'), false);
  assert.equal(steps.some(step => step.type === 'counter'), false);
});
