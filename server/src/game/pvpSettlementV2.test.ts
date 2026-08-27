/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { settlePvpV2WithClient as settlePvpV2, type PvpSettlementV2Input, type UserSettlementDelta } from './pvpSettlementV2';

type QueryCall = { sql: string; params: unknown[] | undefined };

const locked = (id: number, overrides: Partial<Record<string, unknown>> = {}) => ({
  id, money: id === 10 ? 100 : 40, exp: 5, level: 2, statpoints: 9,
  expenabled: true, elo: id === 10 ? 1200 : 1100, guildid: null, ...overrides,
});

const delta = (overrides: Partial<UserSettlementDelta> = {}): UserSettlementDelta => ({
  moneyDelta: 0, battlesDelta: 1, winsDelta: 0, seasonWinsDelta: 0,
  seasonLossesDelta: 1, pvpMoneyWonDelta: 0, pvpMoneyLostDelta: 0,
  expGain: 0, eloDelta: -10, hpAfter: 0, ...overrides,
});

const plan = (overrides: Partial<PvpSettlementV2Input> = {}): PvpSettlementV2Input => ({
  outcome: { kind: 'regular', attackerId: 10, defenderId: 20, winnerId: 10, loserId: 20 },
  userPlans: [
    { userId: 10, ...delta({ moneyDelta: 15, winsDelta: 1, seasonWinsDelta: 1, seasonLossesDelta: 0, pvpMoneyWonDelta: 15, expGain: 10, eloDelta: 12, hpAfter: 22 }) },
    { userId: 20, ...delta({ moneyDelta: -15, pvpMoneyLostDelta: 15, hpAfter: 0 }) },
  ],
  taxPlan: { recipientId: 10, grossIncome: 15, source: 'tax_pvp' },
  history: { attackerId: 10, defenderId: 20, winnerId: 10, log: ['a wins'], steps: [{ type: 'hit' }], attackerHpAfter: 22, defenderHpAfter: 0, expGained: 10, moneyGained: 15, moneyStolen: 15 },
  ...overrides,
});

function clientWithUsers(users = [locked(10), locked(20)], options: { userRowCounts?: number[]; historyRowCount?: number; taxRate?: number; guildId?: number } = {}) {
  const calls: QueryCall[] = [];
  let updateIndex = 0;
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id, money')) return { rowCount: users.length, rows: users };
      if (sql.startsWith('SELECT guildid FROM guild_members')) {
        const winner = users.find(user => user.guildid === options.guildId);
        return winner?.guildid === null || winner?.guildid === undefined ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ guildid: winner.guildid }] };
      }
      if (sql.startsWith('SELECT id, taxrate')) {
        return options.guildId === undefined ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ id: options.guildId, taxrate: options.taxRate ?? 0 }] };
      }
      if (sql.startsWith('UPDATE guilds') || sql.startsWith('INSERT INTO guild_treasury_log')) return { rowCount: 1, rows: [] };
      if (sql.startsWith('update users')) return { rowCount: options.userRowCounts?.[updateIndex++] ?? 1, rows: [] };
      if (sql.startsWith('insert into battles')) return { rowCount: options.historyRowCount ?? 1, rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  } as any;
  return { client, calls };
}

test('regular attacker win settles locked money XP ELO and history', async () => {
  const { client, calls } = clientWithUsers();
  const result = await settlePvpV2(client, plan());
  assert.deepEqual(result.users, {
    10: { money: 115, exp: 15, level: 2, statpoints: 9, elo: 1212, levelsGained: 0 },
    20: { money: 25, exp: 5, level: 2, statpoints: 9, elo: 1090, levelsGained: 0 },
  });
  assert.deepEqual(result.tax, { netIncome: 15, guildId: null, tax: 0 });
  assert.deepEqual(calls.filter(c => c.sql.startsWith('update users')).map(c => c.params?.[c.params.length - 1]), [10, 20]);
  assert.equal(calls.filter(c => c.sql.startsWith('insert into battles')).length, 1);
  for (const call of calls.filter(c => /^(update|insert)/.test(c.sql))) {
    assert.equal(/[A-Z]/.test(call.sql), false, call.sql);
    assert.match(call.sql, /\$1/);
  }
});

test('regular defender win taxes the locked defender symmetrically', async () => {
  const input = plan({ outcome: { kind: 'regular', attackerId: 10, defenderId: 20, winnerId: 20, loserId: 10 }, userPlans: [
    { userId: 10, ...delta({ moneyDelta: -20, pvpMoneyLostDelta: 20, hpAfter: 0 }) },
    { userId: 20, ...delta({ moneyDelta: 20, winsDelta: 1, seasonWinsDelta: 1, seasonLossesDelta: 0, pvpMoneyWonDelta: 20, expGain: 15, eloDelta: 14, hpAfter: 18 }) },
  ], taxPlan: { recipientId: 20, grossIncome: 20, source: 'tax_pvp' }, history: { attackerId: 10, defenderId: 20, winnerId: 20, log: ['d wins'], steps: [], attackerHpAfter: 0, defenderHpAfter: 18, expGained: 15, moneyGained: 20, moneyStolen: 20 } });
  const { client } = clientWithUsers([locked(10), locked(20, { guildid: 3 })], { guildId: 3, taxRate: 10 });
  const result = await settlePvpV2(client, input);
  assert.deepEqual(result.tax, { netIncome: 18, guildId: 3, tax: 2 });
  assert.equal(result.users[20]?.money, 58);
});

test('mercy attacker win uses the same atomic history path', async () => {
  const { client, calls } = clientWithUsers();
  const mercy = plan({
    outcome: { kind: 'mercy', attackerId: 10, defenderId: 20, winnerId: 10, loserId: 20 },
    userPlans: [
      { ...plan().userPlans[0], persistHp: false, lastPvpTime: 1000 },
      { ...plan().userPlans[1], persistHp: false, lastPvpTime: 1000 },
    ],
  });
  await settlePvpV2(client, mercy);
  assert.equal(calls.filter(c => c.sql.startsWith('insert into battles')).length, 1);
  for (const call of calls.filter(c => c.sql.startsWith('update users'))) {
    assert.doesNotMatch(call.sql, /currenthp/);
    assert.match(call.sql, /lastpvptime/);
  }
});

test('locked snapshots control XP level-up and ELO baselines', async () => {
  const { client } = clientWithUsers([locked(10, { exp: 15, level: 2, statpoints: 9, elo: 1500 }), locked(20)]);
  const result = await settlePvpV2(client, plan());
  assert.deepEqual(result.users[10], { money: 115, exp: 5, level: 3, statpoints: 14, elo: 1512, levelsGained: 1 });
});

test('planned income is capped to locked loser balance across settlement and history', async () => {
  const { client, calls } = clientWithUsers([locked(10, { expenabled: false, exp: 7 }), locked(20, { money: 5 })]);
  const result = await settlePvpV2(client, plan());

  assert.deepEqual(result.users[10], { money: 105, exp: 7, level: 2, statpoints: 9, elo: 1212, levelsGained: 0 });
  assert.deepEqual(result.users[20], { money: 0, exp: 5, level: 2, statpoints: 9, elo: 1090, levelsGained: 0 });
  assert.deepEqual(result.tax, { netIncome: 5, guildId: null, tax: 0 });
  assert.equal(result.plannedMoneyStolen, 15);
  assert.equal(result.actualMoneyStolen, 5);
  const updates = calls.filter(call => call.sql.startsWith('update users'));
  assert.equal(updates[0]?.params?.[0], 5);
  assert.equal(updates[0]?.params?.[6], 0);
  assert.equal(updates[1]?.params?.[0], -5);
  assert.equal(updates[1]?.params?.[6], 5);
  const history = calls.find(call => call.sql.startsWith('insert into battles'))!;
  assert.deepEqual(history.params?.slice(-2), [5, 5]);
});

test('XP disabled is respected', async () => {
  const enabled = clientWithUsers([locked(10, { expenabled: false, exp: 7 }), locked(20)]);
  const result = await settlePvpV2(enabled.client, plan());
  assert.equal(result.users[10]?.exp, 7);
});

test('invalid winner tax and history are rejected before writes', async () => {
  const cases = [
    plan({ outcome: { kind: 'regular', attackerId: 10, defenderId: 20, winnerId: 30, loserId: 20 } }),
    plan({ taxPlan: { recipientId: 20, grossIncome: 15, source: 'tax_pvp' } }),
    plan({ taxPlan: { recipientId: 10, grossIncome: 0, source: 'tax_pvp' } }),
    plan({ history: { ...plan().history, winnerId: 20 } }),
    plan({ taxPlan: null, history: { ...plan().history, moneyGained: 0, moneyStolen: 0 } }),
    plan({ userPlans: [
      { ...plan().userPlans[0], winsDelta: 0 },
      plan().userPlans[1],
    ] }),
  ];
  for (const input of cases) { const { client, calls } = clientWithUsers(); await assert.rejects(() => settlePvpV2(client, input)); assert.equal(calls.length, 0); }
});

test('missing users and row-count failures abort', async () => {
  await assert.rejects(() => settlePvpV2(clientWithUsers([locked(10)]).client, plan()), /disappeared/);
  await assert.rejects(() => settlePvpV2(clientWithUsers(undefined, { userRowCounts: [0] }).client, plan()), /user update failed/);
  await assert.rejects(() => settlePvpV2(clientWithUsers(undefined, { historyRowCount: 0 }).client, plan()), /history insert failed/);
});
