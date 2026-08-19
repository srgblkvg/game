/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSilverAmount } from './money.ts';

test('formats silver as a full ru-RU amount without compact notation', () => {
  assert.equal(formatSilverAmount(1_200), '1 200 серебра');
  assert.equal(formatSilverAmount(1_500_000), '1 500 000 серебра');
});

test('preserves Russian silver word forms and the null fallback', () => {
  assert.equal(formatSilverAmount(21), '21 серебро');
  assert.equal(formatSilverAmount(11), '11 серебра');
  assert.equal(formatSilverAmount(null), '0 серебра');
});
