/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldReleaseVkKeyboardFocus, shouldRestoreVkSelection } from './vkKeyboardFocus';

test('отпускает ценовой input при переходе на select длительности', () => {
  assert.equal(shouldReleaseVkKeyboardFocus('SELECT', false), true);
});

test('переключается на другой input через обычный focus handler', () => {
  assert.equal(shouldReleaseVkKeyboardFocus('INPUT', true), false);
});

test('не отпускает input при краткой потере focus в Android WebView', () => {
  assert.equal(shouldReleaseVkKeyboardFocus('BODY', false), false);
});

test('отпускает input при переходе на кнопку', () => {
  assert.equal(shouldReleaseVkKeyboardFocus('BUTTON', false), true);
});

test('восстанавливает сохранённую каретку после переноса React в конец строки', () => {
  assert.equal(shouldRestoreVkSelection(5, 5, 2, 2), true);
});

test('не трогает каретку, если сохранённая позиция уже восстановлена', () => {
  assert.equal(shouldRestoreVkSelection(2, 2, 2, 2), false);
});
