/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'GuildRatingPage.tsx'), 'utf8');

test('guild rating delegates empty/data list state to DataState without changing guild actions', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={false}[\s\S]*isEmpty={guilds\.length === 0}/);
  assert.match(source, /empty={<p className="text-sm text-\[var\(--color-text-muted\)\]">Нет гильдий<\/p>}/);
  assert.match(source, /Рейтинг гильдий/);
  assert.match(source, /fetch\(`\$\{BASE_URL\}\/guild\/list`/);
  assert.match(source, /fetch\(`\$\{BASE_URL\}\/guild\/my`/);
  assert.match(source, /fetch\(`\$\{BASE_URL\}\/guild\/war\/declare`/);
  assert.match(source, /guilds\.map/);
});
