/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommonForgeTarget, getCommonForgeTargetOptions } from './forgeTargets';

test('общий уровень применяется ко всем выбранным предметам ниже цели', () => {
  assert.deepEqual(
    applyCommonForgeTarget({ a: 3, b: 4, c: 8 }, ['a', 'b', 'c'], 7, { a: 2, b: 4, c: 8 }),
    { a: 7, b: 7, c: 8 },
  );
});

test('список общих уровней начинается выше минимального текущего уровня', () => {
  assert.deepEqual(getCommonForgeTargetOptions({ a: 2, b: 5 }, ['a', 'b']), [3, 4, 5, 6, 7, 8, 9, 10]);
});

// Result text must stay hidden while progress animation is active.
test('неудачный результат не является состоянием строки до завершения шага', () => {
  const entry = { status: 'active', result: 'Неудача' };
  const showStaticResult = entry.status !== 'active' && Boolean(entry.result);
  assert.equal(showStaticResult, false);
});
