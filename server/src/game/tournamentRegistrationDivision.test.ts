/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRegistrationDivisionIndex,
  getRegistrationIdentity,
} from './tournamentRegistrationDivision';

const snapshot = (level: number, divisionIndex?: number, divisionBasis?: 'level') => ({
  version: 1 as const,
  combatPower: 100,
  ...(divisionIndex === undefined ? {} : { divisionIndex }),
  ...(divisionBasis === undefined ? {} : { divisionBasis }),
  registeredAt: 1,
  player: { id: 7, name: 'Игрок', level, base: {}, equipment: {}, stats: { s: 1, a: 1, d: 1, m: 1, hp: 4 } },
});

test('level-marked registration keeps the selected overlapping division', () => {
  assert.equal(getRegistrationDivisionIndex(snapshot(5, 0, 'level')), 0);
  assert.equal(getRegistrationDivisionIndex(snapshot(5, 1, 'level')), 1);
  assert.equal(getRegistrationDivisionIndex(snapshot(5, 2, 'level')), 2);
});

test('legacy registration ignores the old power division and falls back by level', () => {
  assert.equal(getRegistrationDivisionIndex(snapshot(10, 9)), 4);
});

test('registration identity allows one user in different divisions but not twice in one', () => {
  assert.equal(getRegistrationIdentity(77, 0), '77:0');
  assert.equal(getRegistrationIdentity(77, 1), '77:1');
  assert.equal(getRegistrationIdentity(77, 0), '77:0');
});
