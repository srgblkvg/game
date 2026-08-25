/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const files = {
  route: readFileSync(resolve(__dirname, '../routes/guild/guildMembers.ts'), 'utf8'),
  scheduler: readFileSync(resolve(__dirname, '../schedulers/inactiveLeader.ts'), 'utf8'),
  account: readFileSync(resolve(__dirname, '../routes/account.ts'), 'utf8'),
};

test('manual role transfer accepts leader and updates guild leader identity atomically', () => {
  assert.match(files.route, /\['officer', 'member', 'leader'\]/);
  assert.match(files.route, /transferGuildLeadership/);
  assert.doesNotMatch(files.route, /UPDATE guild_members SET rank = \?[^]*UPDATE guilds SET leaderId/);
});

test('inactive leader transfer updates guilds.leaderid', () => {
  assert.match(files.scheduler, /transferGuildLeadership/);
});

test('account deletion uses the same leadership transfer seam', () => {
  assert.match(files.account, /transferGuildLeadership/);
  assert.doesNotMatch(files.account, /UPDATE guild_members SET rank = \?[^]*successor\.userId/);
});

for (const [name, source] of Object.entries(files)) {
  test(`${name} has no fire-and-forget leadership split`, () => {
    assert.doesNotMatch(source, /addToTreasury\([^)]*lead/i);
  });
}
