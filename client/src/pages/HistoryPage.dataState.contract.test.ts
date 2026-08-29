/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'HistoryPage.tsx'), 'utf8');

test('history page delegates loading and empty states without changing history behavior', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.equal((source.match(/<DataState/g) || []).length, 2);
  assert.match(source, /isLoading={loading}[\s\S]*isEmpty={false}[\s\S]*loading={<p className="text-\[var\(--color-text-muted\)\]">Загрузка\.\.\.<\/p>}/);
  assert.match(source, /isLoading={false}[\s\S]*isEmpty={paginatedData\.length === 0}[\s\S]*empty={<p className="text-\[var\(--color-text-muted\)\]">Нет записей<\/p>}/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /buildHistoryEntries/);
  assert.match(source, /tabs\.map/);
  assert.match(source, /setPage\(page-1\)/);
  assert.match(source, /setPage\(page\+1\)/);
  assert.match(source, /renderBattleLog/);
});
