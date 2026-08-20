/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { getOperationEntryColor } from './operationProgressPresentation';

test('не раскрывает красным цветом неудачу до завершения прогресс-бара', () => {
  assert.equal(getOperationEntryColor('failure', true, false), '');
});

test('показывает красный цвет неудачи после раскрытия результата', () => {
  assert.equal(getOperationEntryColor('failure', true, true), 'text-[var(--color-accent-danger)]');
});

test('сохраняет цвета завершённых строк', () => {
  assert.equal(getOperationEntryColor('success', false, false), 'text-[var(--color-accent-success)]');
  assert.equal(getOperationEntryColor('stopped', false, false), 'text-[var(--color-text-muted)]');
});
