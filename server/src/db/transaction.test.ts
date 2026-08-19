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
