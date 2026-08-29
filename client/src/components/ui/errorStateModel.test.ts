import { strict as assert } from 'node:assert';
import test from 'node:test';
import { selectErrorText } from './errorStateModel.ts';

test('returns the provided error text when an error exists', () => {
  assert.equal(selectErrorText('Не удалось загрузить'), 'Не удалось загрузить');
});

test('returns null when there is no error', () => {
  assert.equal(selectErrorText(''), null);
  assert.equal(selectErrorText(null), null);
  assert.equal(selectErrorText(undefined), null);
});
