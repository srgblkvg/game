/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'ProfilePage.tsx'), 'utf8');

test('profile page delegates loading and missing-profile states to DataState', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={loading}[\s\S]*isEmpty={!profile}/);
  assert.match(source, /loading={<div className="p-4 text-\[var\(--color-text-primary\)\]">Загрузка\.\.\.<\/div>}/);
  assert.match(source, /empty={<div className="p-4 text-\[var\(--color-text-primary\)\]">Игрок не найден<\/div>}/);
  assert.match(source, /<div className="max-w-3xl mx-auto px-4 py-4">[\s\S]*CharacterCard/);
});
