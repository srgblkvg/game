/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  processVkSilverPayment,
  type VkPaymentDeliveryRepository,
  type VkPaymentDeliveryTransaction,
  type LockedVkDeliveryClaim,
} from './vkPaymentDelivery';

type State = {
  claim: LockedVkDeliveryClaim | null;
  bank: number | null;
  writes: string[];
};

function repository(initial: State) {
  let state = { ...initial, claim: initial.claim ? { ...initial.claim } : null, writes: [...initial.writes] };
  const repo: VkPaymentDeliveryRepository = {
    async transaction(callback) {
      const draft: State = { claim: state.claim ? { ...state.claim } : null, bank: state.bank, writes: [] };
      const tx: VkPaymentDeliveryTransaction = {
        async claim(input) {
          if (!draft.claim) {
            draft.claim = { ...input, status: 'pending' };
            draft.writes.push('claim');
          }
          return { ...draft.claim };
        },
        async lockVkUser(vkUserId) {
          return vkUserId === 77 ? { id: 7, bank: draft.bank } : null;
        },
        async addBank(characterId, amount) {
          assert.equal(characterId, 7);
          draft.bank = (draft.bank ?? 0) + amount;
          draft.writes.push(`bank:${amount}`);
        },
        async logPayment(input) {
          draft.writes.push(`log:${input.orderId}`);
        },
        async markSucceeded(orderId, processedAt) {
          assert.equal(orderId, 'order-1');
          assert.ok(draft.claim);
          draft.claim.status = 'succeeded';
          draft.claim.processedAt = processedAt;
          draft.writes.push('succeeded');
        },
      };
      const result = await callback(tx);
      state = draft;
      return result;
    },
  };
  return { repo, state: () => state };
}

const input = (overrides: Record<string, unknown> = {}) => ({
  orderId: 'order-1', vkUserId: 77, item: 'silver_10000', providerPrice: 7, processedAt: 1234, ...overrides,
});

test('новый VK order начисляет bank и фиксирует delivery в одной transaction', async () => {
  const state = repository({ claim: null, bank: null, writes: [] });
  const result = await processVkSilverPayment(state.repo, input());
  assert.deepEqual(result, { status: 'delivered', characterId: 7, item: 'silver_10000', silverAmount: 10000 });
  assert.equal(state.state().bank, 10000);
  assert.deepEqual(state.state().writes, ['claim', 'bank:10000', 'log:order-1', 'succeeded']);
});

test('исторически backfilled order не выдаётся повторно', async () => {
  const state = repository({
    claim: { provider: 'vk', externalId: 'order-1', providerUserId: 77, item: 'silver_10000', status: 'succeeded', processedAt: 100 },
    bank: 500,
    writes: [],
  });
  const result = await processVkSilverPayment(state.repo, input());
  assert.deepEqual(result, { status: 'already-processed' });
  assert.equal(state.state().bank, 500);
  assert.deepEqual(state.state().writes, []);
});

test('повтор order с другой identity отклоняется до user write', async () => {
  const state = repository({
    claim: { provider: 'vk', externalId: 'order-1', providerUserId: 77, item: 'silver_10000', status: 'succeeded', processedAt: 100 },
    bank: 500,
    writes: [],
  });
  const result = await processVkSilverPayment(state.repo, input({ item: 'silver_50000', providerPrice: 14 }));
  assert.equal(result.status, 'rejected');
  assert.equal(state.state().bank, 500);
  assert.deepEqual(state.state().writes, []);
});

for (const bad of [
  { item: 'not_silver' },
  { providerPrice: 8 },
  { vkUserId: 0 },
  { orderId: '' },
]) {
  test(`invalid VK input ${JSON.stringify(bad)} не пишет состояние`, async () => {
    const state = repository({ claim: null, bank: 5, writes: [] });
    const result = await processVkSilverPayment(state.repo, input(bad));
    assert.equal(result.status, 'rejected');
    assert.equal(state.state().bank, 5);
    assert.deepEqual(state.state().writes, []);
  });
}

test('порядок блокировок ledger → user; payment log до succeeded', async () => {
  const state = repository({ claim: null, bank: 0, writes: [] });
  await processVkSilverPayment(state.repo, input());
  assert.deepEqual(state.state().writes, ['claim', 'bank:10000', 'log:order-1', 'succeeded']);
});

test('ошибка succeeded откатывает bank, log и claim', async () => {
  const state = repository({ claim: null, bank: 5, writes: [] });
  const failing: VkPaymentDeliveryRepository = {
    transaction: callback => state.repo.transaction(tx => callback({
      ...tx,
      async markSucceeded() { throw new Error('status failure'); },
    })),
  };
  await assert.rejects(processVkSilverPayment(failing, input()), /status failure/);
  assert.equal(state.state().bank, 5);
  assert.equal(state.state().claim, null);
});
