/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(__dirname, '../routes/craft.ts'), 'utf8');
const start = source.indexOf("router.post('/craft/auto-attempt'");
const end = source.indexOf("router.get('/craft/upgrade-info", start);
const route = source.slice(start, end);

test('auto-attempt commits recipe mutation and treasury commission together', () => {
  assert.match(route, /await db\.tx\(async client/);
  assert.match(route, /SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE/);
  assert.match(route, /SELECT \* FROM users WHERE id = \$1 FOR UPDATE/);
  assert.match(route, /await changeTreasuryWithClient\(\s*client,\s*Math\.floor\(moneyCost \* 0\.22\),\s*success \? 'craft_recipe' : 'craft_recipe_fail'\s*\)/);
  assert.doesNotMatch(route, /addToTreasury\(Math\.floor\(result\.moneyCost/);
  assert.ok(route.indexOf('castle_treasury') < route.indexOf('SELECT * FROM users'));
});

test('auto-attempt keeps achievements and guild quest effects post-commit', () => {
  const transactionEnd = route.indexOf('});', route.indexOf('await db.tx'));
  assert.ok(transactionEnd >= 0);
  assert.ok(route.indexOf('checkAchievement') > transactionEnd);
  assert.ok(route.indexOf('updateGuildQuestProgress') > transactionEnd);
  assert.ok(route.indexOf('markDirty') > transactionEnd);
});
