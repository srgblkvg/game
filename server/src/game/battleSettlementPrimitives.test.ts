/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyExpWithClient,
  collectGuildTaxWithClient,
} from './battleSettlementPrimitives';

function fakeClient(responses: Array<any>) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    calls,
    client: {
      async query(sql: string, params: unknown[] = []) {
        calls.push({ sql, params });
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response ?? { rows: [], rowCount: 1 };
      },
    } as any,
  };
}

test('applyExpWithClient reads expenabled on the transaction client and applies level semantics', async () => {
  const { client, calls } = fakeClient([{ rows: [{ expenabled: true }], rowCount: 1 }]);

  const result = await applyExpWithClient(client, 7, 30, 5, 1, 9);

  assert.deepEqual(result, {
    newExp: 5,
    newLevel: 3,
    levelsGained: 2,
    newStatPoints: 19,
  });
  assert.deepEqual(calls, [{
    sql: 'SELECT expenabled FROM users WHERE id = $1',
    params: [7],
  }]);
});

test('applyExpWithClient disables experience without triggering transaction achievement effects', async () => {
  const { client, calls } = fakeClient([{ rows: [{ expenabled: false }], rowCount: 1 }]);

  const result = await applyExpWithClient(client, 7, 999, 1, 3, 4);

  assert.deepEqual(result, {
    newExp: 1,
    newLevel: 3,
    levelsGained: 0,
    newStatPoints: 4,
  });
  assert.equal(calls.length, 1);
});

test('collectGuildTaxWithClient returns unchanged income without a member and does not write', async () => {
  const { client, calls } = fakeClient([{ rows: [], rowCount: 0 }]);

  const result = await collectGuildTaxWithClient(client, 7, 100, 'tax_pvp');

  assert.deepEqual(result, { netIncome: 100, guildId: null, tax: 0 });
  assert.equal(calls.length, 1);
});

test('collectGuildTaxWithClient updates treasury and logs tax on the same client', async () => {
  const { client, calls } = fakeClient([
    { rows: [{ guildid: 12, taxrate: 10 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const result = await collectGuildTaxWithClient(client, 7, 15, 'tax_pvp');

  assert.deepEqual(result, { netIncome: 14, guildId: 12, tax: 1 });
  assert.deepEqual(calls.map(call => call.sql), [
    'SELECT gm.guildid, g.taxrate FROM guild_members gm JOIN guilds g ON gm.guildid = g.id WHERE gm.userid = $1 FOR UPDATE OF g',
    'UPDATE guilds SET treasury = treasury + $1 WHERE id = $2',
    'INSERT INTO guild_treasury_log (guildid, userid, amount, type, createdat) VALUES ($1, $2, $3, $4, $5)',
  ]);
  assert.deepEqual(calls[1]?.params, [1, 12]);
  assert.deepEqual(calls[2]?.params.slice(0, 4), [12, 7, 1, 'tax_pvp']);
});

test('collectGuildTaxWithClient preserves zero-income and zero-rate behavior', async () => {
  const zeroIncome = fakeClient([]);
  assert.deepEqual(
    await collectGuildTaxWithClient(zeroIncome.client, 7, 0, 'tax_pvp'),
    { netIncome: 0, guildId: null, tax: 0 },
  );
  assert.equal(zeroIncome.calls.length, 0);

  const zeroRate = fakeClient([{ rows: [{ guildid: 12, taxrate: 0 }], rowCount: 1 }]);
  assert.deepEqual(
    await collectGuildTaxWithClient(zeroRate.client, 7, 100, 'tax_pvp'),
    { netIncome: 100, guildId: 12, tax: 0 },
  );
  assert.equal(zeroRate.calls.length, 1);
});

// Battle route integration is intentionally not done in this bounded seam.
// Global helper behavior remains unchanged.
