/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceEnemyAttack, cancelEnemyWindup, ENEMY_WINDUP_MS } from './dungeonWindup';

test('завершение таймера начинает замах без немедленного удара', () => {
  const result = advanceEnemyAttack({ attackElapsedMs: 1000, attackIntervalMs: 1000, windupStartedAtMs: null }, 10_000);
  assert.equal(result.shouldAttack, false);
  assert.equal(result.state.windupStartedAtMs, 10_000);
});

test('удар разрешается только после 800 мс замаха', () => {
  const early = advanceEnemyAttack({ attackElapsedMs: 1000, attackIntervalMs: 1000, windupStartedAtMs: 10_000 }, 10_000 + ENEMY_WINDUP_MS - 1);
  assert.equal(early.shouldAttack, false);

  const ready = advanceEnemyAttack(early.state, 10_000 + ENEMY_WINDUP_MS);
  assert.equal(ready.shouldAttack, true);
  assert.equal(ready.state.attackElapsedMs, 0);
  assert.equal(ready.state.windupStartedAtMs, null);
});

test('оглушение отменяет замах и перезапускает полный таймер атаки', () => {
  const state = cancelEnemyWindup({ attackElapsedMs: 1000, attackIntervalMs: 1000, windupStartedAtMs: 10_000 });
  assert.deepEqual(state, { attackElapsedMs: 0, attackIntervalMs: 1000, windupStartedAtMs: null });
});
