/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeInTransaction, type TransactionExecutor } from './transaction';

function recordingExecutor(events: string[]): TransactionExecutor {
  return {
    async begin() {
      events.push('BEGIN');
    },
    async commit() {
      events.push('COMMIT');
    },
    async rollback() {
      events.push('ROLLBACK');
    },
  };
}

test('результат callback концептуально коммитится и возвращается', async () => {
  const events: string[] = [];
  const result = await executeInTransaction(recordingExecutor(events), async () => {
    events.push('CALLBACK');
    return { id: 42 };
  });

  assert.deepEqual(result, { id: 42 });
  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'COMMIT']);
});

test('ошибка callback концептуально откатывается и пробрасывается', async () => {
  const events: string[] = [];
  const failure = new Error('callback failed');

  await assert.rejects(
    executeInTransaction(recordingExecutor(events), async () => {
      events.push('CALLBACK');
      throw failure;
    }),
    failure,
  );

  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'ROLLBACK']);
});

test('ошибка begin пробрасывается без callback и rollback', async () => {
  const events: string[] = [];
  const failure = new Error('begin failed');
  const executor = recordingExecutor(events);
  executor.begin = async () => {
    events.push('BEGIN');
    throw failure;
  };

  await assert.rejects(executeInTransaction(executor, async () => {
    events.push('CALLBACK');
    return 1;
  }), failure);

  assert.deepEqual(events, ['BEGIN']);
});

test('ошибка commit вызывает rollback и пробрасывается', async () => {
  const events: string[] = [];
  const failure = new Error('commit failed');
  const executor = recordingExecutor(events);
  executor.commit = async () => {
    events.push('COMMIT');
    throw failure;
  };

  await assert.rejects(executeInTransaction(executor, async () => {
    events.push('CALLBACK');
    return 1;
  }), failure);

  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'COMMIT', 'ROLLBACK']);
});

test('ошибка rollback не скрывает исходную ошибку callback', async () => {
  const events: string[] = [];
  const originalFailure = new Error('callback failed');
  const executor = recordingExecutor(events);
  executor.rollback = async () => {
    events.push('ROLLBACK');
    throw new Error('rollback failed');
  };

  await assert.rejects(executeInTransaction(executor, async () => {
    events.push('CALLBACK');
    throw originalFailure;
  }), originalFailure);

  assert.deepEqual(events, ['BEGIN', 'CALLBACK', 'ROLLBACK']);
});
