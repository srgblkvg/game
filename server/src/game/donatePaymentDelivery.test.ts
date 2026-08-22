/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  processYooKassaSilverPayment,
  type DonatePaymentDeliveryRepository,
  type DonatePaymentDeliveryTransaction,
  type LockedYooKassaPayment,
} from './donatePaymentDelivery';

type State = { payment: LockedYooKassaPayment; bank: number | null; writes: string[] };

function repository(initial: Omit<State, 'writes'>) {
  let state: State = { payment: { ...initial.payment }, bank: initial.bank, writes: [] };
  const repo: DonatePaymentDeliveryRepository = {
    async transaction(callback) {
      const draft: State = { payment: { ...state.payment }, bank: state.bank, writes: [] };
      const tx: DonatePaymentDeliveryTransaction = {
        async lockPayment(paymentId) {
          return draft.payment.paymentId === paymentId ? { ...draft.payment } : null;
        },
        async lockUser(userId) {
          return draft.payment.userId === userId ? { id: userId, bank: draft.bank } : null;
        },
        async addBank(userId, amount) {
          assert.equal(userId, draft.payment.userId);
          draft.bank = (draft.bank ?? 0) + amount;
          draft.writes.push(`bank:${amount}`);
        },
        async markSucceeded(paymentId, processedAt) {
          assert.equal(paymentId, draft.payment.paymentId);
          draft.payment.status = 'succeeded';
          draft.payment.processedAt = processedAt;
          draft.writes.push('payment:succeeded');
        },
      };
      const result = await callback(tx);
      state = draft;
      return result;
    },
  };
  return { repo, state: () => state };
}

const pending = (overrides: Partial<LockedYooKassaPayment> = {}): LockedYooKassaPayment => ({
  paymentId: 'pay-1', userId: 7, item: 'silver_10000', amount: '49.00', status: 'pending', processedAt: 1,
  ...overrides,
});
const verified = (overrides: Record<string, unknown> = {}) => ({
  paymentId: 'pay-1', providerUserId: '7', providerItem: 'silver_10000',
  verifiedAmount: '49.00', verifiedCurrency: 'RUB', processedAt: 1234,
  ...overrides,
});

test('один pending payment начисляет silver в bank ровно один раз и помечает succeeded', async () => {
  const state = repository({ payment: pending(), bank: 50 });
  const result = await processYooKassaSilverPayment(state.repo, verified());
  assert.deepEqual(result, { status: 'delivered', userId: 7, item: 'silver_10000', silverAmount: 10000 });
  assert.equal(state.state().bank, 10050);
  assert.equal(state.state().payment.status, 'succeeded');
  assert.equal(state.state().payment.processedAt, 1234);
  assert.deepEqual(state.state().writes, ['bank:10000', 'payment:succeeded']);
});

test('повторная обработка возвращает already-processed без повторного начисления', async () => {
  const state = repository({ payment: pending({ status: 'succeeded' }), bank: 10050 });
  const result = await processYooKassaSilverPayment(state.repo, verified());
  assert.deepEqual(result, { status: 'already-processed' });
  assert.equal(state.state().bank, 10050);
  assert.deepEqual(state.state().writes, []);
});

test('bank NULL становится ровно purchased amount', async () => {
  const state = repository({ payment: pending({ item: 'silver_50000', amount: '99.00' }), bank: null });
  const result = await processYooKassaSilverPayment(state.repo, verified({ providerItem: 'silver_50000', verifiedAmount: '99.00' }));
  assert.equal(result.status, 'delivered');
  assert.equal(state.state().bank, 50000);
});

for (const [name, payment, input] of [
  ['provider user', pending(), verified({ providerUserId: '8' })],
  ['provider item', pending(), verified({ providerItem: 'silver_50000' })],
  ['local item', pending({ item: 'not_silver' }), verified({ providerItem: 'not_silver' })],
  ['local amount', pending({ amount: '50.00' }), verified({ verifiedAmount: '50.00' })],
  ['provider amount', pending(), verified({ verifiedAmount: '50.00' })],
  ['currency', pending(), verified({ verifiedCurrency: 'USD' })],
] as const) {
  test(`${name} mismatch отклоняется без записей`, async () => {
    const state = repository({ payment, bank: 50 });
    const result = await processYooKassaSilverPayment(state.repo, input as any);
    assert.equal(result.status, 'rejected');
    assert.equal(state.state().bank, 50);
    assert.equal(state.state().payment.status, 'pending');
    assert.deepEqual(state.state().writes, []);
  });
}

test('ошибка mark succeeded откатывает bank в transaction repository', async () => {
  const state = repository({ payment: pending(), bank: 50 });
  const failing: DonatePaymentDeliveryRepository = {
    transaction: callback => state.repo.transaction(async tx => callback({
      ...tx,
      async markSucceeded() { throw new Error('status write failed'); },
    })),
  };
  await assert.rejects(processYooKassaSilverPayment(failing, verified()), /status write failed/);
  assert.equal(state.state().bank, 50);
  assert.equal(state.state().payment.status, 'pending');
});

test('payment lock is acquired before user lock and no overflow operation exists', async () => {
  const events: string[] = [];
  const repo: DonatePaymentDeliveryRepository = { async transaction(callback) {
    return callback({
      async lockPayment() { events.push('payment'); return pending(); },
      async lockUser() { events.push('user'); return { id: 7, bank: 0 }; },
      async addBank() { events.push('bank'); },
      async markSucceeded() { events.push('succeeded'); },
    });
  } };
  await processYooKassaSilverPayment(repo, verified());
  assert.deepEqual(events, ['payment', 'user', 'bank', 'succeeded']);
});
