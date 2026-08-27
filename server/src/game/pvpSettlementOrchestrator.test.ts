/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { runSettlementAndEffects } from './pvpSettlementOrchestrator';

test('awaits settlement before invoking effects and returns its result', async () => {
  const order: string[] = [];
  const settlement = Promise.resolve({ id: 42, status: 'settled' }).then(result => {
    order.push('settled');
    return result;
  });

  const result = await runSettlementAndEffects(
    () => settlement,
    async settled => {
      order.push(`effects:${settled.id}`);
      await Promise.resolve();
      order.push('effects:done');
    },
  );

  assert.deepEqual(result, { id: 42, status: 'settled' });
  assert.deepEqual(order, ['settled', 'effects:42', 'effects:done']);
});

test('supports synchronous effects after settlement', async () => {
  const order: string[] = [];

  const result = await runSettlementAndEffects(
    async () => {
      order.push('settle:start');
      await Promise.resolve();
      order.push('settle:done');
      return 'result';
    },
    value => {
      order.push(`effects:${value}`);
    },
  );

  assert.equal(result, 'result');
  assert.deepEqual(order, ['settle:start', 'settle:done', 'effects:result']);
});

test('propagates settlement rejection and does not invoke effects', async () => {
  const settlementError = new Error('settlement failed');
  let effectsInvoked = false;

  await assert.rejects(
    () => runSettlementAndEffects(
      async () => {
        throw settlementError;
      },
      () => {
        effectsInvoked = true;
      },
    ),
    error => error === settlementError,
  );

  assert.equal(effectsInvoked, false);
});

test('propagates effects rejection after settlement succeeds', async () => {
  const effectsError = new Error('effects failed');
  let settled = false;

  await assert.rejects(
    () => runSettlementAndEffects(
      async () => {
        settled = true;
        return 7;
      },
      async result => {
        assert.equal(result, 7);
        throw effectsError;
      },
    ),
    error => error === effectsError,
  );

  assert.equal(settled, true);
});
