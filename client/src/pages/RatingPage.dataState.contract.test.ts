/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'RatingPage.tsx'), 'utf8');

test('rating page delegates empty/data list state without changing filters and pagination', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={false}[\s\S]*isEmpty={players\.length === 0}/);
  assert.match(source, /empty={<p className="text-\[var\(--color-text-muted\)\]">Нет игроков<\/p>}/);
  assert.match(source, /fetchRating\(1, 3, '', 0\)/);
  assert.match(source, /fetchRating\(page, LIMIT, search, minElo, 0, SKIP_TOP\)/);
  assert.match(source, /setTimeout\(\(\) =>[\s\S]*300\)/);
  assert.match(source, /RATING_FILTERS\.map/);
  assert.match(source, /players\.map/);
  assert.match(source, /setPage\(page - 1\)/);
  assert.match(source, /setPage\(page \+ 1\)/);
});
