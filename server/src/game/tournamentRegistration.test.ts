/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { isTournamentRegistrationOpen } from './tournamentRegistration';

const window = { registrationStart: 1_000, registrationEnd: 2_000 };

test('регистрация закрыта до начала окна', () => {
  assert.equal(isTournamentRegistrationOpen(window, 999), false);
});

test('регистрация открыта с момента начала и внутри окна', () => {
  assert.equal(isTournamentRegistrationOpen(window, 1_000), true);
  assert.equal(isTournamentRegistrationOpen(window, 1_999), true);
});

test('регистрация закрыта с момента окончания окна', () => {
  assert.equal(isTournamentRegistrationOpen(window, 2_000), false);
  assert.equal(isTournamentRegistrationOpen(window, 2_001), false);
});
