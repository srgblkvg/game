import { strict as assert } from 'node:assert';
import test from 'node:test';
import { formatClockCountdown } from './clockCountdown.ts';

test('formats seconds as minutes and zero-padded seconds', () => {
  assert.equal(formatClockCountdown(0), '0:00');
  assert.equal(formatClockCountdown(61), '1:01');
  assert.equal(formatClockCountdown(3605), '60:05');
});

test('clamps negative and fractional seconds', () => {
  assert.equal(formatClockCountdown(-1), '0:00');
  assert.equal(formatClockCountdown(12.9), '0:12');
});
