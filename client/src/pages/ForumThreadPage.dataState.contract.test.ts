/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'ForumThreadPage.tsx'), 'utf8');

test('forum thread delegates initial error/loading states to DataState without changing thread behavior', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={!thread && !error}[\s\S]*error={!thread \? error : null}[\s\S]*isEmpty={false}/);
  assert.match(source, /loading={<div className="p-4">Загрузка\.\.\.<\/div>}/);
  assert.match(source, /errorState={<ErrorState error={error} \/>}/);
  assert.match(source, /{thread \? \([\s\S]*<div className="px-4 py-4 max-w-3xl mx-auto">/);
  assert.match(source, /fetch\(`\/api\/forum\/thread\/\$\{id\}/);
  assert.match(source, /fetch\('\/api\/forum\/reply'/);
  assert.match(source, /handleVote/);
  assert.match(source, /goToPage/);
  assert.match(source, /buildForumPostTree\(posts\)/);
});
