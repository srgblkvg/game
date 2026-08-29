/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEligibleTournamentDivisions,
  getTournamentDivisionByKey,
} from './tournamentDivision';

test('дивизионы определяются по старым пересекающимся диапазонам уровней', () => {
  assert.deepEqual(getEligibleTournamentDivisions(1).map(division => division.key), ['copper']);
  assert.deepEqual(getEligibleTournamentDivisions(3).map(division => division.key), ['copper', 'bronze']);
  assert.deepEqual(getEligibleTournamentDivisions(5).map(division => division.key), ['copper', 'bronze', 'iron']);
});

test('диапазоны продолжаются с шагом два уровня', () => {
  assert.deepEqual(
    ['copper', 'bronze', 'iron', 'steel'].map(key => {
      const division = getTournamentDivisionByKey(key)!;
      return [division.minLevel, division.maxLevel];
    }),
    [[1, 5], [3, 7], [5, 9], [7, 11]],
  );
});

test('верхний дивизион принимает игроков начиная с 19 уровня', () => {
  assert.deepEqual(getEligibleTournamentDivisions(30).map(division => division.key), ['orichalcum']);
});
