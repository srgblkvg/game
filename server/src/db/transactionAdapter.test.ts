/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWithPoolClient, poolClientTransactionExecutor } from './transactionAdapter';

test('PoolClient adapter maps transaction lifecycle to query calls', async () => {
  const events: string[] = [];
  const client = {
    async query(sql: string) {
      events.push(sql);
    },
    release() {
      events.push('RELEASE');
    },
  };

  const executor = poolClientTransactionExecutor(client);
  await executor.begin();
  await executor.commit();
  await executor.rollback();
  client.release();

  assert.deepEqual(events, ['BEGIN', 'COMMIT', 'ROLLBACK', 'RELEASE']);
});

test('PoolClient adapter preserves query failures', async () => {
  const failure = new Error('BEGIN failed');
  const client = {
    async query() {
      throw failure;
    },
    release() {},
  };

  await assert.rejects(poolClientTransactionExecutor(client).begin(), failure);
});

test('PoolClient adapter does not swallow rollback failures', async () => {
  const failure = new Error('ROLLBACK failed');
  const client = {
    async query(sql: string) {
      if (sql === 'ROLLBACK') throw failure;
    },
    release() {},
  };

  await assert.rejects(poolClientTransactionExecutor(client).rollback(), failure);
});

test('PoolClient-like adapter works with callback seam and preserves original callback error', async () => {
  const originalFailure = new Error('callback failed');
  const events: string[] = [];
  const client = {
    async query(sql: string) {
      events.push(sql);
      if (sql === 'ROLLBACK') throw new Error('rollback failed');
    },
    release() {
      events.push('RELEASE');
    },
  };

  const { executeInTransaction } = await import('./transaction');
  await assert.rejects(
    executeInTransaction(poolClientTransactionExecutor(client), async () => {
      events.push('CALLBACK');
      throw originalFailure;
    }),
    originalFailure,
  );

  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'ROLLBACK']);
});

test('PoolClient transaction releases after commit', async () => {
  const events: string[] = [];
  const client = {
    async query(sql: string) {
      events.push(sql);
    },
    release() {
      events.push('RELEASE');
    },
  };

  const result = await executeWithPoolClient(client, async () => {
    events.push('CALLBACK');
    return 42;
  });

  assert.equal(result, 42);
  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'COMMIT', 'RELEASE']);
});

test('PoolClient transaction releases and preserves callback error when rollback fails', async () => {
  const originalFailure = new Error('callback failed');
  const events: string[] = [];
  const client = {
    async query(sql: string) {
      events.push(sql);
      if (sql === 'ROLLBACK') throw new Error('rollback failed');
    },
    release() {
      events.push('RELEASE');
    },
  };

  await assert.rejects(executeWithPoolClient(client, async () => {
    events.push('CALLBACK');
    throw originalFailure;
  }), originalFailure);

  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'ROLLBACK', 'RELEASE']);
});

test('PoolClient transaction releases when begin fails', async () => {
  const failure = new Error('BEGIN failed');
  const events: string[] = [];
  const client = {
    async query(sql: string) {
      events.push(sql);
      throw failure;
    },
    release() {
      events.push('RELEASE');
    },
  };

  await assert.rejects(executeWithPoolClient(client, async () => {
    events.push('CALLBACK');
  }), failure);

  assert.deepEqual(events, ['BEGIN', 'RELEASE']);
});

export {};
