/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'TavernPage.tsx'), 'utf8');

test('tavern page delegates loading state to DataState without changing the data view', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={!tavern}[\s\S]*isEmpty={false}/);
  assert.match(source, /loading={<div className="p-4">Загрузка\.\.\.<\/div>}/);
  assert.match(source, /<div className="max-w-3xl mx-auto px-4 py-4">[\s\S]*Трактир/);
  assert.match(source, /tavern\.rooms\.map/);
  assert.match(source, /handleHeal/);
  assert.match(source, /handleRent/);
  assert.match(source, /handleDrink/);
});
