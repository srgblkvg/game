/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCountdown, formatCountdownMinutes } from './countdown.ts';

test('formats short countdown without negative values', () => {
  assert.equal(formatCountdown(0), '0с');
  assert.equal(formatCountdown(61), '1м 1с');
  assert.equal(formatCountdown(3661), '1ч 1м');
  assert.equal(formatCountdown(-5), '0с');
});

test('preserves tournament day/hour/minute formatting', () => {
  assert.equal(formatCountdownMinutes(90), '1 мин');
  assert.equal(formatCountdownMinutes(3661), '1 ч 1 мин');
  assert.equal(formatCountdownMinutes(90061), '1 дн 1 ч 1 мин');
  assert.equal(formatCountdownMinutes(-5), '0 мин');
});
