/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDataState, type DataState } from './dataState.ts';

test('selects loading before inspecting the current data', () => {
  const state: DataState<string[]> = selectDataState(true, ['stale']);
  assert.deepEqual(state, { status: 'loading' });
});

test('selects empty for an empty collection', () => {
  assert.deepEqual(selectDataState(false, []), { status: 'empty' });
});

test('selects ready and preserves the original data reference', () => {
  const data = ['one'];
  const state = selectDataState(false, data);
  assert.equal(state.status, 'ready');
  assert.equal(state.data, data);
});

test('supports a typed empty predicate for non-collections', () => {
  assert.deepEqual(selectDataState(false, { items: [] }, value => value.items.length === 0), { status: 'empty' });
});
