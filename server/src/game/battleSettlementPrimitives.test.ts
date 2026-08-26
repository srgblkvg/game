/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyExpFromSnapshot, collectGuildTaxWithClient, lockPvpUsers } from './battleSettlementPrimitives';

const user = (overrides: Partial<any> = {}) => ({ id: 7, money: 100, exp: 5, level: 2, statpoints: 9, expenabled: true, elo: 1000, guildid: null, ...overrides });

test('XP derives from locked snapshot, not caller snapshot', () => {
  assert.deepEqual(applyExpFromSnapshot(user({ exp: 15, level: 2, statpoints: 9 }), 10), { newExp: 5, newLevel: 3, levelsGained: 1, newStatPoints: 14 });
});

test('disabled experience leaves locked values unchanged', () => {
  assert.deepEqual(applyExpFromSnapshot(user({ expenabled: false, exp: 15 }), 100), { newExp: 15, newLevel: 2, levelsGained: 0, newStatPoints: 9 });
});

test('users lock in ascending order and retain snapshots', async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => { calls.push(sql); return { rowCount: 2, rows: [user({ id: 5 }), user({ id: 20 })] }; } } as any;
  const result = await lockPvpUsers(client, [20, 5]);
  assert.match(calls[0]!, /ORDER BY id ASC FOR UPDATE/);
  assert.deepEqual(result.map(row => row.id), [5, 20]);
});

test('tax checks treasury and log row counts on the same client', async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => { calls.push(sql); if (sql.includes('guild_members')) return { rowCount: 1, rows: [{ guildid: 3 }] }; if (sql.startsWith('SELECT')) return { rowCount: 1, rows: [{ id: 3, taxrate: 10 }] }; return { rowCount: 1, rows: [] }; } } as any;
  assert.deepEqual(await collectGuildTaxWithClient(client, user({ guildid: 3 }), 15, 'tax_pvp'), { netIncome: 14, guildId: 3, tax: 1 });
  assert.equal(calls.length, 4);
});

test('tax fails closed when treasury update is missing', async () => {
  const client = { query: async (sql: string) => sql.includes('guild_members') ? { rowCount: 1, rows: [{ guildid: 3 }] } : sql.startsWith('SELECT') ? { rowCount: 1, rows: [{ id: 3, taxrate: 10 }] } : { rowCount: 0, rows: [] } } as any;
  await assert.rejects(() => collectGuildTaxWithClient(client, user({ guildid: 3 }), 15, 'tax_pvp'), /treasury update failed/);
});

test('tax locks membership and requires it to match the user snapshot', async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => { calls.push(sql); if (sql.includes('guild_members')) return { rowCount: 1, rows: [{ guildid: 3 }] }; return { rowCount: 1, rows: [{ id: 3, taxrate: 0 }] }; } } as any;
  await collectGuildTaxWithClient(client, user({ guildid: 3 }), 15, 'tax_pvp');
  assert.match(calls[0]!, /guild_members.*FOR UPDATE/);
  assert.match(calls[1]!, /^SELECT id, taxrate FROM guilds/);
});

test('tax fails closed when locked guild membership is missing', async () => {
  const client = { query: async () => ({ rowCount: 0, rows: [] }) } as any;
  await assert.rejects(() => collectGuildTaxWithClient(client, user({ guildid: 3 }), 15, 'tax_pvp'), /membership is missing/);
});

test('tax fails closed on mismatched guild membership', async () => {
  const client = { query: async () => ({ rowCount: 1, rows: [{ guildid: 4 }] }) } as any;
  await assert.rejects(() => collectGuildTaxWithClient(client, user({ guildid: 3 }), 15, 'tax_pvp'), /membership does not match/);
});

// Settlement route integration remains intentionally out of scope.
