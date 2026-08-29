/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'CollectionsPage.tsx'), 'utf8');

test('collections page delegates loading state without changing collection level behavior', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={loading}[\s\S]*isEmpty={false}/);
  assert.match(source, /loading={<div className="p-4 max-w-3xl mx-auto"><h1 className="text-xl font-bold mb-4">Коллекция<\/h1><p className="text-sm text-\[var\(--color-text-muted\)\]">Загрузка\.\.\.<\/p><\/div>}/);
  assert.match(source, /{!loading && \([\s\S]*<h1 className="text-xl font-bold mb-2">Коллекция/);
  assert.match(source, /upgradelevel=\$\{activeTab\}/);
  assert.match(source, /activeTab === 0\s*\? inv\.filter/);
  assert.match(source, /normalizedLevel = activeTab === 0 \? 0 : 7/);
  assert.match(source, /fetch\('\/api\/collections\/add'/);
  assert.match(source, /setCharacter\(\(prev: any\)/);
});
