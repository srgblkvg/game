/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { processYooKassaPremiumPayment } from './donatePremiumDelivery';
import type { DonatePremiumRepository, DonatePremiumTransaction } from './donatePremiumDelivery';

function repository(item = 'premium_7d', amount = '99.00', premiumUntil: number | null = 0) {
  let payment: any = { paymentId: 'premium-payment', userId: 7, item, amount, status: 'pending' };
  let user: any = { id: 7, premiumUntil };
  const writes: string[] = [];
  const tx: DonatePremiumTransaction = {
    async lockPayment() { return payment; },
    async lockUser() { return user; },
    async savePremium(_userId, nextUntil) { user = { ...user, premiumUntil: nextUntil }; writes.push('premium'); },
    async markSucceeded() { payment = { ...payment, status: 'succeeded' }; writes.push('succeeded'); },
  };
  return { repository: { transaction: async (cb: any) => cb(tx) } as DonatePremiumRepository, state: () => ({ payment, user, writes }) };
}

const input = (item = 'premium_7d', amount = '99.00') => ({
  paymentId: 'premium-payment', providerUserId: '7', providerItem: item,
  verifiedAmount: amount, verifiedCurrency: 'RUB', processedAt: 1_700_000_000,
});

test('YooKassa premium_7d продлевает premium и завершает payment', async () => {
  const state = repository();
  const result = await processYooKassaPremiumPayment(state.repository, input());
  assert.deepEqual(result, { status: 'delivered', userId: 7, item: 'premium_7d', premiumUntil: 1_700_604_800 });
  assert.deepEqual(state.state().writes, ['premium', 'succeeded']);
});

test('premium_30d использует точную цену и срок', async () => {
  const state = repository('premium_30d', '299.00', 1_700_000_000);
  const result = await processYooKassaPremiumPayment(state.repository, input('premium_30d', '299.00'));
  assert.deepEqual(result, { status: 'delivered', userId: 7, item: 'premium_30d', premiumUntil: 1_702_592_000 });
});

test('replay не продлевает premium повторно', async () => {
  const state = repository();
  await processYooKassaPremiumPayment(state.repository, input());
  const before = state.state().user.premiumUntil;
  assert.equal((await processYooKassaPremiumPayment(state.repository, input())).status, 'already-processed');
  assert.equal(state.state().user.premiumUntil, before);
});

test('provider mismatch отклоняется без writes', async () => {
  const state = repository();
  const result = await processYooKassaPremiumPayment(state.repository, input('premium_7d', '98.00'));
  assert.equal(result.status, 'rejected');
  assert.deepEqual(state.state().writes, []);
});

// Keep the wished-for import RED until the service exists.
assert.ok(processYooKassaPremiumPayment);
