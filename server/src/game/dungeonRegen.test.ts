import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDungeonRegenTick } from './dungeonRegen';

test('accumulates fractional dungeon regen across short ticks', () => {
  let hp = 50;
  let remainder = 0;

  for (let tick = 0; tick < 10; tick += 1) {
    const result = applyDungeonRegenTick({
      playerHp: hp,
      playerMaxHp: 100,
      regenRate: 1,
      tickSeconds: 0.1,
      remainder,
    });
    hp = result.playerHp;
    remainder = result.remainder;
  }

  assert.equal(hp, 53);
  assert.ok(remainder >= 0 && remainder < 1);
});

test('never heals above maximum hp', () => {
  const result = applyDungeonRegenTick({
    playerHp: 99,
    playerMaxHp: 100,
    regenRate: 5,
    tickSeconds: 0.1,
    remainder: 0.8,
  });

  assert.equal(result.playerHp, 100);
  assert.equal(result.remainder, 0);
});

test('continue uses the healed hp from the active run instead of the stale saved hp', async () => {
  const { resolveDungeonContinueVitals } = await import('./dungeonRegen');
  assert.deepEqual(resolveDungeonContinueVitals(
    { playerHp: 40, playerMaxHp: 100 },
    { playerHp: 80, playerMaxHp: 100 },
  ), { playerHp: 80, playerMaxHp: 100 });
});
