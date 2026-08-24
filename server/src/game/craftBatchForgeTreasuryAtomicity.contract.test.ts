/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(__dirname, '../routes/craft.ts'), 'utf8');
const start = source.indexOf("router.post('/craft/batch-forge',");
const end = source.indexOf('export default router', start);
const route = source.slice(start, end);

test('batch forge commits all results and treasury commission together', () => {
  assert.match(route, /await db\.tx\(async client/);
  assert.match(route, /SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE/);
  assert.match(route, /SELECT \* FROM users WHERE id = \$1 FOR UPDATE/);
  assert.match(route, /await changeTreasuryWithClient\(client, Math\.floor\(spent \* 0\.22\), 'craft_batch_forge'\)/);
  assert.doesNotMatch(route, /addToTreasury\(Math\.floor\(result\.spent/);
  assert.ok(route.indexOf('castle_treasury') < route.indexOf('SELECT * FROM users'));
});

test('batch forge notifications and quest effects remain post-commit', () => {
  const transactionEnd = route.indexOf('});', route.indexOf('await db.tx'));
  assert.ok(transactionEnd >= 0);
  assert.ok(route.indexOf('checkAchievement') > transactionEnd);
  assert.ok(route.indexOf('markDirty') > transactionEnd);
  assert.ok(route.indexOf('updateGuildQuestProgress') > transactionEnd);
  assert.ok(route.indexOf("broadcast('message'") > transactionEnd);
});
