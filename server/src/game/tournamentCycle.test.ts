/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OFFICIAL_CYCLE_INTERVAL,
  OFFICIAL_REGISTRATION_DURATION,
  getOfficialCycleState,
  getLonelyQueueDisposition,
  getRegistrationWindowForNewQueue,
} from './tournamentCycle';

test('после завершения общего набора регистрация закрыта ровно на 1 час', () => {
  const completedAt = 1_000_000;
  const before = getOfficialCycleState({ now: completedAt + OFFICIAL_CYCLE_INTERVAL - 1, lastCompletedAt: completedAt });
  assert.equal(before.registrationOpen, false);
  assert.equal(before.registrationOpensAt, completedAt + 60 * 60);

  const atOpening = getOfficialCycleState({ now: completedAt + OFFICIAL_CYCLE_INTERVAL, lastCompletedAt: completedAt });
  assert.equal(atOpening.registrationOpen, true);
  assert.equal(atOpening.registrationOpensAt, null);
});

test('первая очередь открывает общее окно регистрации на 1 час', () => {
  const window = getRegistrationWindowForNewQueue({ now: 2_000_000, activeQueues: [] });
  assert.deepEqual(window, {
    registrationStart: 2_000_000,
    registrationEnd: 2_000_000 + OFFICIAL_REGISTRATION_DURATION,
  });
});

test('новые диапазоны внутри набора получают тот же срок закрытия', () => {
  const window = getRegistrationWindowForNewQueue({
    now: 2_000_300,
    activeQueues: [
      { registrationStart: 2_000_000, registrationEnd: 2_000_000 + OFFICIAL_REGISTRATION_DURATION },
      { registrationStart: 2_000_000, registrationEnd: 2_000_000 + OFFICIAL_REGISTRATION_DURATION },
    ],
  });
  assert.deepEqual(window, {
    registrationStart: 2_000_000,
    registrationEnd: 2_000_000 + OFFICIAL_REGISTRATION_DURATION,
  });
});

test('после закрытия общего окна нельзя создавать позднюю очередь', () => {
  const window = getRegistrationWindowForNewQueue({
    now: 2_001_000,
    activeQueues: [{ registrationStart: 2_000_000, registrationEnd: 2_000_900 }],
  });
  assert.equal(window, null);
});

test('идущий турнир не считается открытой регистрацией', () => {
  const state = getOfficialCycleState({
    now: 3_000_000,
    lastCompletedAt: 2_900_000,
    hasInProgressTournament: true,
  });
  assert.equal(state.registrationOpen, false);
  assert.equal(state.registrationOpensAt, null);
});

test('единственный участник завершается без бесконечного продления регистрации', () => {
  const now = 4_000_000;
  assert.deepEqual(getLonelyQueueDisposition({ now, participantCount: 1 }), {
    cancelCurrentQueue: true,
    nextRegistrationOpensAt: now + OFFICIAL_CYCLE_INTERVAL,
  });
});
