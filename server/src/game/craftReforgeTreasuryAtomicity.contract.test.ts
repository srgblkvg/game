/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(__dirname, '../routes/craft.ts'), 'utf8');
const start = source.indexOf("router.post('/craft/reforge'");
const end = source.indexOf('async function loadBatchForgePlan', start);
const reforge = source.slice(start, end);

test('reforge charges treasury commission inside its domain transaction', () => {
  assert.match(source, /import \{ addToTreasury, changeTreasuryWithClient \} from '\.\.\/game\/treasury'/);
  assert.match(reforge, /await db\.tx\(async client/);
  assert.match(reforge, /SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE/);
  assert.match(reforge, /await changeTreasuryWithClient\(client, Math\.floor\(cost \* 0\.22\), 'craft_reforge'\)/);
  assert.doesNotMatch(reforge, /addToTreasury\([\s\S]*'craft_reforge'/);
  assert.ok(reforge.indexOf('castle_treasury') < reforge.indexOf('SELECT inventory, money'));
});

test('reforge post-commit side effects remain outside the transaction', () => {
  const txEnd = reforge.indexOf('});', reforge.indexOf('await db.tx'));
  assert.ok(txEnd >= 0);
  assert.ok(reforge.indexOf('checkAchievement') > txEnd);
  assert.ok(reforge.indexOf('markDirty') > txEnd);
  assert.ok(reforge.indexOf('updateGuildQuestProgress') > txEnd);
});
