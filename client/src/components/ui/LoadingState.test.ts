/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { selectLoadingText } from './loadingState.ts';

test('selects the preserved default loading text while loading', () => {
  assert.equal(selectLoadingText(true), 'Загрузка...');
  assert.equal(selectLoadingText(false), null);
});

test('selects custom loading text when provided', () => {
  assert.equal(selectLoadingText(true, 'Загрузка профиля...'), 'Загрузка профиля...');
});
