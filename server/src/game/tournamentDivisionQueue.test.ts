/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateDivisionPrizePools, splitParticipantsByDivision } from './tournamentDivisionQueue';

const participant = (userId: number, division: number, combatPower: number) => ({ userId, division, combatPower });

test('общая очередь разделяется строго по сохранённому динамическому дивизиону', () => {
  const result = splitParticipantsByDivision([
    participant(1, 0, 90),
    participant(2, 0, 5000),
    participant(3, 1, 100),
    participant(4, 1, 499),
  ]);
  assert.deepEqual(result.divisions.map(group => ({ division: group.division, ids: group.participants.map(p => p.userId) })), [
    { division: 0, ids: [1, 2] },
    { division: 1, ids: [3, 4] },
  ]);
  assert.deepEqual(result.singletons, []);
});

test('дивизион с числом участников больше восьми не дробится до группового этапа', () => {
  const entries = Array.from({ length: 17 }, (_, index) => participant(index + 1, 2, 500 + index));
  const result = splitParticipantsByDivision(entries);
  assert.equal(result.divisions.length, 1);
  assert.equal(result.divisions[0]!.participants.length, 17);
});

test('одиночный дивизион с чрезмерным разрывом возвращается как несобранный', () => {
  const result = splitParticipantsByDivision([
    participant(1, 0, 50),
    participant(2, 0, 60),
    participant(3, 5, 100_000),
  ]);
  assert.deepEqual(result.divisions.map(group => group.division), [0]);
  assert.deepEqual(result.divisions[0]!.participants.map(entry => entry.userId), [1, 2]);
  assert.deepEqual(result.singletons.map(entry => entry.userId), [3]);
});

test('совместимые одиночные дивизионы объединяются', () => {
  const result = splitParticipantsByDivision([
    participant(1, 0, 100),
    participant(2, 1, 114),
  ]);
  assert.deepEqual(result.divisions.map(group => group.participants.map(entry => entry.userId)), [[1, 2]]);
  assert.deepEqual(result.singletons, []);
});

test('несколько одиночных дивизионов объединяются, чтобы зарегистрированные игроки не пропадали', () => {
  const result = splitParticipantsByDivision([
    participant(1, 0, 50),
    participant(2, 0, 60),
    participant(3, 1, 100),
    participant(4, 2, 110),
    participant(5, 3, 120),
    participant(6, 4, 130),
  ]);
  const ids = result.divisions.flatMap(group => group.participants.map(entry => entry.userId));
  assert.deepEqual(ids.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(result.singletons, []);
});

test('порядок дивизионов и участников детерминирован для воспроизводимого фонда', () => {
  const result = splitParticipantsByDivision([
    participant(9, 3, 3000),
    participant(4, 1, 120),
    participant(2, 3, 2900),
    participant(1, 1, 110),
  ]);
  assert.deepEqual(result.divisions.map(group => [group.division, group.participants.map(p => p.userId)]), [
    [1, [1, 4]],
    [3, [2, 9]],
  ]);
});

test('доля несовместимого одиночника сохраняется отдельно от фондов созданных дивизионов', () => {
  const split = splitParticipantsByDivision([
    participant(1, 0, 50),
    participant(2, 0, 60),
    participant(3, 1, 120),
    participant(4, 1, 140),
    participant(5, 5, 100_000),
  ]);
  const allocation = allocateDivisionPrizePools(10_000, split, entry => entry.division + 1);
  assert.deepEqual(allocation.divisionPools, [
    { division: 0, prizePool: 1666 },
    { division: 1, prizePool: 3333 },
  ]);
  assert.equal(allocation.refund, 5001);
  assert.equal(allocation.divisionPools.reduce((sum, row) => sum + row.prizePool, 0) + allocation.refund, 10_000);
});
