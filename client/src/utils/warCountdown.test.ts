import assert from 'node:assert/strict';
import test from 'node:test';
import { getWarTimeRemaining } from './warCountdown.ts';

test('calculates hours and minutes from an absolute expiry time', () => {
    assert.deepEqual(getWarTimeRemaining('2026-08-27T12:00:00Z', Date.parse('2026-08-27T09:25:00Z')), {
        expiresInMs: 2 * 60 * 60 * 1000 + 35 * 60 * 1000,
        hours: 2,
        minutes: 35,
        expired: false,
    });
});

test('clamps expired wars to zero', () => {
    assert.deepEqual(getWarTimeRemaining('2026-08-27T09:00:00Z', Date.parse('2026-08-27T09:00:00Z')), {
        expiresInMs: 0,
        hours: 0,
        minutes: 0,
        expired: true,
    });
});

test('supports numeric unix milliseconds and invalid dates without NaN', () => {
    assert.deepEqual(getWarTimeRemaining(Date.parse('2026-08-27T10:30:00Z'), Date.parse('2026-08-27T10:00:00Z')), {
        expiresInMs: 30 * 60 * 1000,
        hours: 0,
        minutes: 30,
        expired: false,
    });
    assert.deepEqual(getWarTimeRemaining('not-a-date', Date.parse('2026-08-27T10:00:00Z')), {
        expiresInMs: 0,
        hours: 0,
        minutes: 0,
        expired: true,
    });
});
