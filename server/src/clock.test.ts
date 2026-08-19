/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { nowSecFromMs, systemClock, type Clock } from './clock';

test('перевод миллисекунд в Unix-секунды отбрасывает дробную часть', () => {
  assert.equal(nowSecFromMs(1_700_000_123_999), 1_700_000_123);
});

test('systemClock читает системное время в миллисекундах и секундах', () => {
  const fixedMs = 1_700_000_123_999;
  const originalNow = Date.now;
  Date.now = () => fixedMs;

  try {
    assert.equal(systemClock.nowMs(), fixedMs);
    assert.equal(systemClock.nowSec(), 1_700_000_123);
  } finally {
    Date.now = originalNow;
  }
});

test('детерминированные часы позволяют независимо задавать nowMs и nowSec', () => {
  const fixedMs = 1_700_000_123_999;
  const fakeClock: Clock = {
    nowMs: () => fixedMs,
    nowSec: () => nowSecFromMs(fixedMs),
  };

  assert.equal(fakeClock.nowMs(), fixedMs);
  assert.equal(fakeClock.nowSec(), 1_700_000_123);
});
