/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { transferGuildLeadershipWithClient } from './guildLeadership';

function client(calls: any[], ranks: any[] = [{ userid: 10, rank: 'leader' }, { userid: 20, rank: 'member' }]) {
  return {
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM guilds')) return { rows: [{ id: 3, leaderid: 10 }], rowCount: 1 };
      if (sql.includes('FROM guild_members')) return { rows: ranks, rowCount: ranks.length };
      return { rows: [], rowCount: 1 };
    },
  } as any;
}

test('transfers rank and guild leader identity in one ordered client flow', async () => {
  const calls: any[] = [];
  await transferGuildLeadershipWithClient(client(calls), { guildId: 3, currentLeaderId: 10, newLeaderId: 20 });
  assert.match(calls[0].sql, /guilds[\s\S]*FOR UPDATE/);
  assert.match(calls[1].sql, /guild_members[\s\S]*FOR UPDATE/);
  assert.match(calls[2].sql, /SET rank = 'officer'/);
  assert.match(calls[3].sql, /SET rank = 'leader'/);
  assert.match(calls[4].sql, /SET leaderid/);
});

test('rejects a non-leader current membership before writes', async () => {
  const calls: any[] = [];
  await assert.rejects(
    transferGuildLeadershipWithClient(client(calls, [{ userid: 10, rank: 'officer' }, { userid: 20, rank: 'member' }]), { guildId: 3, currentLeaderId: 10, newLeaderId: 20 }),
    /current guild leader membership mismatch/,
  );
  assert.equal(calls.filter(call => /UPDATE guild_members|UPDATE guilds/.test(call.sql)).length, 0);
});

test('rejects drift between guild leader identity and leader membership', async () => {
  const calls: any[] = [];
  const driftedClient = {
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM guilds')) return { rows: [{ id: 3, leaderid: 99 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  } as any;
  await assert.rejects(
    transferGuildLeadershipWithClient(driftedClient, { guildId: 3, currentLeaderId: 10, newLeaderId: 20 }),
    /guild leader identity mismatch/,
  );
  assert.equal(calls.length, 1);
});

test('rejects an already leader successor', async () => {
  await assert.rejects(
    transferGuildLeadershipWithClient(client([], [{ userid: 10, rank: 'leader' }, { userid: 20, rank: 'leader' }]), { guildId: 3, currentLeaderId: 10, newLeaderId: 20 }),
    /successor guild membership mismatch/,
  );
});
