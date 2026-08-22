/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { currentStats } from './stats';

const base = { s: 5, a: 5, d: 5, m: 5 };
const item = (set: string) => ({ bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { set } });

test('один предмет Отшельника не активирует ускоренный реген', () => {
  const stats = currentStats(base, { helmet: item('Отшельник') as any });
  assert.equal(stats.hermitRegen, undefined);
});

test('два предмета Отшельника активируют ускоренный реген', () => {
  const stats = currentStats(base, {
    helmet: item('Отшельник') as any,
    chest: item('Отшельник') as any,
  });
  assert.equal(stats.hermitRegen, true);
  assert.ok(stats.setBonuses?.includes('Отшельник: +100% реген HP (вне боя)'));
});

test('английский ключ hermit активирует тот же бонус', () => {
  const stats = currentStats(base, {
    boots: item('hermit') as any,
    ring: item('hermit') as any,
  });
  assert.equal(stats.hermitRegen, true);
});
