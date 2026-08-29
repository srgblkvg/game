import assert from 'node:assert/strict';
import test from 'node:test';
import { getDungeonRegenPresentation } from './dungeonRegen.ts';

test('shows dungeon hp per second and time to full health', () => {
  assert.deepEqual(getDungeonRegenPresentation({ playerHp: 50, playerMaxHp: 100, regenRate: 1 }), {
    hpPerSecond: 3,
    secondsToFull: 17,
    timeToFull: '0:17',
  });
});

test('shows zero remaining time at full health', () => {
  assert.deepEqual(getDungeonRegenPresentation({ playerHp: 100, playerMaxHp: 100, regenRate: 1 }), {
    hpPerSecond: 3,
    secondsToFull: 0,
    timeToFull: '0:00',
  });
});
