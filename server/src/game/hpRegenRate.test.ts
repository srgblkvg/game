/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHpRegenRate } from './hpRegen';

const now = 1_000_000;

test('базовый реген восстанавливает 1 HP за 5 секунд', () => {
  assert.equal(calculateHpRegenRate({}, now), 1);
});

test('Отшельник удваивает базовый реген', () => {
  assert.equal(calculateHpRegenRate({ hermitRegen: true }, now), 2);
});

test('премиум и активная комната перемножаются с Отшельником', () => {
  assert.equal(calculateHpRegenRate({
    hermitRegen: true,
    premiumUntil: now + 100,
    roomType: 'bed',
    roomUntil: now + 100,
  }, now), 60);
});

test('истёкшие премиум и комната не увеличивают реген', () => {
  assert.equal(calculateHpRegenRate({
    hermitRegen: true,
    premiumUntil: now - 1,
    roomType: 'lux',
    roomUntil: now - 1,
  }, now), 2);
});
