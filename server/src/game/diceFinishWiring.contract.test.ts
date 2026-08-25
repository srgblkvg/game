/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(__dirname, '../routes/dice.ts'), 'utf8');

test('/dice/finish delegates settlement to atomic domain operation', () => {
  assert.match(source, /finishDiceGame\(diceFinishRepository/);
  assert.match(source, /createPgDiceFinishRepository/);
  assert.doesNotMatch(source, /UPDATE users SET money = money \+ \?/);
  assert.doesNotMatch(source, /UPDATE dice_games SET status = 'finished'/);
});

test('/dice/finish preserves the legacy not-found response', () => {
  assert.match(source, /status\(404\)\.json\(\{ error: 'Игра не найдена' \}\)/);
});

assert.equal(typeof source, 'string');
