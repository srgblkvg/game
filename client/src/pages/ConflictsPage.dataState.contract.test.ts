/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'ConflictsPage.tsx'), 'utf8');

test('conflicts page preserves loading and empty presentation through DataState', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={!loaded}[\s\S]*isEmpty={wars\.length === 0}/);
  assert.match(source, /loading={<p className="text-sm text-\[var\(--color-text-muted\)\] text-center py-4">Загрузка\.\.\.<\/p>}/);
  assert.match(source, /empty={<p className="text-sm text-\[var\(--color-text-muted\)\] text-center py-4">[\s\S]*Сейчас нет активных войн\. Мирное время![\s\S]*<\/p>}/);
  assert.match(source, /<div className="space-y-3">[\s\S]*wars\.map/);
});
