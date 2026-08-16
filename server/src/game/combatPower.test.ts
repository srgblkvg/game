/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCombatPower } from './combatPower';

test('одинаковые итоговые статы дают одинаковую мощь', () => {
  const a: any = { s: 10, a: 20, d: 30, m: 40, hp: 100, extra: {} };
  const b: any = { s: 10, a: 20, d: 30, m: 40, hp: 100, extra: {} };
  assert.equal(calculateCombatPower(a), calculateCombatPower(b));
});

test('основные статы дают основной вклад в мощь', () => {
  const base: any = { s: 10, a: 10, d: 10, m: 10, hp: 100, extra: {} };
  const stronger: any = { ...base, s: 20 };
  assert.ok(calculateCombatPower(stronger) > calculateCombatPower(base));
});

test('extra и эффекты добавляют умеренный бонус', () => {
  const base: any = { s: 10, a: 10, d: 10, m: 10, hp: 100, extra: {} };
  const effects: any = { ...base, extra: { crit: 30, dodge: 30 }, vampirism: 5, execute: true };
  assert.ok(calculateCombatPower(effects) > calculateCombatPower(base));
  assert.ok(calculateCombatPower(effects) < calculateCombatPower({ ...base, s: 30, a: 30, d: 30, m: 30 }));
});

test('личные и гильдейские anti-таланты входят в боевую мощь', () => {
  const stats: any = { s: 10, a: 10, d: 10, m: 10, hp: 100, extra: {} };
  const antiStats: any = { antiDodge: 2, antiCrit: 3, antiBlock: 1, antiCounter: 0, antiVampiric: 4 };
  assert.ok(calculateCombatPower(stats, antiStats) > calculateCombatPower(stats));
});
