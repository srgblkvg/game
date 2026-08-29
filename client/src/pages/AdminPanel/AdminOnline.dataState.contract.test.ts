/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'AdminOnline.tsx'), 'utf8');

test('admin online delegates both empty/data lists without changing activity reporting', () => {
  assert.match(source, /import DataState from '\.\.\/\.\.\/components\/ui\/DataState';/);
  assert.equal((source.match(/<DataState/g) || []).length, 2);
  assert.match(source, /isLoading={false}[\s\S]*isEmpty={online\.length === 0}/);
  assert.match(source, /empty={<p className="text-sm text-\[var\(--color-text-muted\)\]">Нет активных сессий<\/p>}/);
  assert.match(source, /isLoading={false}[\s\S]*isEmpty={pages\.length === 0}/);
  assert.match(source, /empty={<p className="text-sm text-\[var\(--color-text-muted\)\]">Данные появятся после первых heartbeat\.<\/p>}/);
  assert.match(source, /fetch\(`\/api\/admin\/activity\?days=\$\{days\}`/);
  assert.match(source, /online\.map/);
  assert.match(source, /pages\.map/);
  assert.match(source, /setDays\(Number\(e\.target\.value\)\)/);
});
