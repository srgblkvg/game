/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'DungeonPage.tsx'), 'utf8');

test('dungeon rest room displays regen speed and time to full health', () => {
  assert.match(source, /getDungeonRegenPresentation/);
  assert.match(source, /Восстановление: \+{regenPresentation\.hpPerSecond} HP\/с/);
  assert.match(source, /полное через {regenPresentation\.timeToFull}/);
  assert.match(source, /setPlayerHp\(data\.playerHp\)/);
  assert.match(source, /setRegenRate\(data\.regenRate \|\| 1\)/);
});
