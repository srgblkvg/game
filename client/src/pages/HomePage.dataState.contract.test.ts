/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'HomePage.tsx'), 'utf8');

test('home page delegates loading state without changing character actions and cooldowns', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={!character}[\s\S]*isEmpty={false}/);
  assert.match(source, /loading={<div className="p-4 text-\[var\(--color-text-primary\)\]">Загрузка\.\.\.<\/div>}/);
  assert.match(source, /{character \? \([\s\S]*<LeftSidebar/);
  assert.match(source, /fetchCharacter\(\)\.then\(setCharacter\)/);
  assert.match(source, /enterArena\(\)/);
  assert.match(source, /equipItem\(slotId, effectiveItemId\)/);
  assert.match(source, /character \? getRemaining\(\(character\.lastAttackTime \|\| 0\) \+ pvpCd\)/);
  assert.match(source, /character \? getRemaining\(\(character\.lastPveAttackTime \|\| 0\) \+ pveCd\)/);
  assert.match(source, /character \? getRemaining\(\(character\.lastBankVisit \|\| 0\) \+ 1800\)/);
});
