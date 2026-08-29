/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'LeftSidebar.tsx'), 'utf8');

test('character card prefers the server regen rate including set bonuses', () => {
  assert.match(source, /regenRate={character\.hpRegenRate \?\?/);
  assert.match(source, /if \(effectiveRoom && effectiveRoom\.until > serverTime\)/);
  assert.match(source, /if \(\(character\.premium\?\.until \|\| 0\) > serverTime\) rate \*= 3/);
});
