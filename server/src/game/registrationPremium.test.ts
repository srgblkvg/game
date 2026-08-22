/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { grantRegistrationPremium, REGISTRATION_PREMIUM_SECONDS } from './registrationPremium';

test('новая email-регистрация получает ровно сутки премиума', () => {
  const now = 1_000_000;
  assert.equal(grantRegistrationPremium(0, now), now + REGISTRATION_PREMIUM_SECONDS);
});

test('действующий премиум продлевается на сутки', () => {
  const now = 1_000_000;
  const currentUntil = now + 3600;
  assert.equal(grantRegistrationPremium(currentUntil, now), currentUntil + REGISTRATION_PREMIUM_SECONDS);
});

test('некорректное значение срока безопасно считается отсутствующим', () => {
  const now = 1_000_000;
  assert.equal(grantRegistrationPremium('invalid', now), now + REGISTRATION_PREMIUM_SECONDS);
});
