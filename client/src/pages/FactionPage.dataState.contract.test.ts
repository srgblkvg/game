/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'FactionPage.tsx'), 'utf8');

test('faction page delegates loading state to DataState without changing faction behavior', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={!data}[\s\S]*isEmpty={false}/);
  assert.match(source, /loading={<div className="p-4 max-w-3xl mx-auto"><BackButton \/><p className="text-sm text-\[var\(--color-text-muted\)\]">Загрузка\.\.\.<\/p><\/div>}/);
  assert.match(source, /{data \? \([\s\S]*<h1 className="text-xl font-bold mb-4 flex items-center gap-2">/);
  assert.match(source, /fetch\('\/api\/faction', \{ headers: getHeaders\(\) \}\)/);
  assert.match(source, /fetch\('\/api\/faction\/choose'/);
  assert.match(source, /fetch\('\/api\/faction\/change'/);
  assert.match(source, /fetch\(`\/api\/faction\/top\/\$\{data\.current\}`/);
  assert.match(source, /title="Смена фракции"/);
});
