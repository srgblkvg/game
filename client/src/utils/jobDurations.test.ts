import { strict as assert } from 'node:assert';
import test from 'node:test';
import { JOB_DURATIONS } from './jobDurations.ts';

test('job durations preserve the existing labels, seconds, and icons', () => {
  assert.deepEqual(JOB_DURATIONS, [
    { label: '10 мин', value: 600, icon: 'game-icons:stopwatch' },
    { label: '30 мин', value: 1800, icon: 'game-icons:hourglass' },
    { label: '1 час', value: 3600, icon: 'game-icons:clockwork' },
    { label: '8 часов', value: 28800, icon: 'game-icons:sundial' },
  ]);
});

test('job durations are ordered from shortest to longest', () => {
  assert.deepEqual(JOB_DURATIONS.map(duration => duration.value), [600, 1800, 3600, 28800]);
});
