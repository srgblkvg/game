/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve(__dirname, '../routes/craft.ts'), 'utf8');
const helperSource = readFileSync(resolve(__dirname, 'craftUpgrade.ts'), 'utf8');
const start = routeSource.indexOf("router.post('/craft/upgrade'");
const end = routeSource.indexOf('// Проклятие предмета', start);
const route = routeSource.slice(start, end);

test('upgrade route uses one transaction and post-commit effects', () => {
  assert.match(route, /await db\.tx\(client => executeCraftUpgradeWithClient\(client/);
  assert.doesNotMatch(route, /addToTreasury\(/);
  const tx = route.indexOf('await db.tx');
  for (const effect of ['checkAchievement', 'updateGuildQuestProgress', 'markDirty', "broadcast('message'"]) {
    assert.ok(route.indexOf(effect) > tx, `${effect} must run after transaction`);
  }
  assert.match(route, /if \(result\.body\.success === true\)/);
});

test('upgrade helper locks treasury before user and owns all economic/chat writes', () => {
  const treasuryLock = helperSource.indexOf("SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE");
  const userLock = helperSource.indexOf("SELECT * FROM users WHERE id = $1 FOR UPDATE");
  assert.ok(treasuryLock >= 0 && userLock > treasuryLock);
  assert.match(helperSource, /changeTreasuryWithClient\(client, commission, 'craft_upgrade'\)/);
  assert.match(helperSource, /changeTreasuryWithClient\(client, commission, 'craft_upgrade_fail'\)/);
  assert.match(helperSource, /INSERT INTO chat_messages/);
});

test('upgrade keeps legacy break, rating and exact public messages', () => {
  for (const marker of ['targetLevel >= 7', 'targetLevel === 7 ? 5', 'targetLevel === 10 ? 50', 'Неудача! Предмет разрушен.', 'Неудача! Предмет не улучшен.', 'Предмет улучшен до +']) {
    assert.ok(helperSource.includes(marker), `missing ${marker}`);
  }
});
