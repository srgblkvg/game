import { strict as assert } from 'node:assert';
import test from 'node:test';
import { selectDataState } from './dataStateModel.ts';

test('loading takes precedence over error and empty data', () => {
  assert.equal(selectDataState({ isLoading: true, error: 'Ошибка', isEmpty: true }), 'loading');
});

test('error takes precedence over empty data after loading', () => {
  assert.equal(selectDataState({ isLoading: false, error: 'Ошибка', isEmpty: true }), 'error');
});

test('empty is selected when loading and error are absent', () => {
  assert.equal(selectDataState({ isLoading: false, error: null, isEmpty: true }), 'empty');
});

test('data is selected when no fallback state applies', () => {
  assert.equal(selectDataState({ isLoading: false, error: null, isEmpty: false }), 'data');
});
