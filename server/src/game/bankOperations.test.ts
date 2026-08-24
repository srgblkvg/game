/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { depositWithClient, transferWithClient } from './bankOperations';

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

test('deposit writes balance, operation, treasury and audit on one client', async () => {
  const { client, calls } = fakeClient([
    { rows: [{ amount: 1000 }], rowCount: 1 },
    { rows: [{ money: 5000 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ amount: 1020 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ money: 4000, bank: 980 }], rowCount: 1 },
  ]);

  const result = await depositWithClient(client, 7, 1000);

  assert.deepEqual(result, { money: 4000, bank: 980, commission: 20, deposited: 980 });
  assert.equal(calls.filter(call => call.sql.includes('UPDATE castle_treasury')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO treasury_log')).length, 1);
  assert.ok(calls.findIndex(call => call.sql.includes('castle_treasury') && call.sql.includes('FOR UPDATE'))
    < calls.findIndex(call => call.sql.includes('SELECT money FROM users')));
});

test('deposit treasury failure rejects instead of committing a partial success', async () => {
  const failure = new Error('treasury unavailable');
  const { client } = fakeClient([
    { rows: [{ amount: 1000 }], rowCount: 1 },
    { rows: [{ money: 5000 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    failure,
  ]);
  await assert.rejects(() => depositWithClient(client, 7, 1000), failure);
});

test('transfer locks users deterministically and writes commission on the same client', async () => {
  const { client, calls } = fakeClient([
    { rows: [{ id: 9 }], rowCount: 1 },
    { rows: [{ amount: 1000 }], rowCount: 1 },
    { rows: [
      { id: 7, username: 'sender', bank: 5000, accountnumber: 'SEND01' },
      { id: 9, username: 'target', bank: 100, accountnumber: 'TARGET' },
    ], rowCount: 2 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ amount: 1020 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ bank: 4000 }], rowCount: 1 },
  ]);

  const result = await transferWithClient(client, 7, 'TARGET', 1000);

  assert.deepEqual(result, { bank: 4000, targetUsername: 'target', commission: 20, receivedAmount: 980 });
  const lock = calls.find(call => call.sql.includes('ORDER BY id FOR UPDATE'));
  assert.deepEqual(lock?.params, [[7, 9]]);
  assert.equal(calls.filter(call => call.sql.includes('UPDATE castle_treasury')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO treasury_log')).length, 1);
});
