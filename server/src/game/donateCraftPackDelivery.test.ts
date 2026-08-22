/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  processYooKassaCraftRarePayment,
  type DonateCraftPackRepository,
  type DonateCraftPackTransaction,
  type CraftCatalogItem,
} from './donateCraftPackDelivery';

const core: CraftCatalogItem = { id: 10, name: 'Сердцевина бездны', rarityId: 4, type: 'craft', image: '/core.webp', rarityDisplay: 'Легендарный', rarityColor: '#f00' };
const stone: CraftCatalogItem = { id: 11, name: 'Рунный булыжник', rarityId: 0, type: 'upgrade', image: '/stone.webp', rarityDisplay: 'Обычный', rarityColor: '#aaa' };

function repository(options: { inventory?: string; bank?: number | null; items?: CraftCatalogItem[] } = {}) {
  let payment = { paymentId: 'pay-craft', userId: 7, item: 'craft_rare', amount: '99.00', status: 'pending' };
  let inventory = options.inventory ?? JSON.stringify([{ type: 'craft_item', id: 10, count: 2 }]);
  let bank = options.bank ?? null;
  const items = options.items ?? [core, stone];
  const writes: string[] = [];
  const repo: DonateCraftPackRepository = { async transaction(callback) {
    const draft = { payment: { ...payment }, inventory, bank, writes: [] as string[] };
    const tx: DonateCraftPackTransaction = {
      async lockPayment(id) { return id === payment.paymentId ? { ...draft.payment } : null; },
      async lockUser(id) { return id === 7 ? { id, inventory: draft.inventory, bank: draft.bank } : null; },
      async findCraftItems(names) { return items.filter(item => names.includes(item.name)); },
      async saveUser(_id, nextInventory, bankDelta) { draft.inventory = nextInventory; draft.bank = (draft.bank ?? 0) + bankDelta; draft.writes.push('user'); },
      async markSucceeded() { draft.payment.status = 'succeeded'; draft.writes.push('succeeded'); },
    };
    const result = await callback(tx);
    payment = draft.payment; inventory = draft.inventory; bank = draft.bank; writes.splice(0, writes.length, ...draft.writes);
    return result;
  }};
  return { repo, state: () => {
    let parsedInventory: any = null;
    try { parsedInventory = JSON.parse(inventory); } catch {}
    return { payment, inventory: parsedInventory, inventoryRaw: inventory, bank, writes };
  }};
}

const input = (overrides: Record<string, unknown> = {}) => ({
  paymentId: 'pay-craft', providerUserId: '7', providerItem: 'craft_rare',
  verifiedAmount: '99.00', verifiedCurrency: 'RUB', processedAt: 123, ...overrides,
});

test('craft_rare стакает оба обязательных предмета, bank и succeeded атомарно', async () => {
  const state = repository();
  const result = await processYooKassaCraftRarePayment(state.repo, input());
  assert.deepEqual(result, { status: 'delivered', userId: 7, item: 'craft_rare' });
  assert.equal(state.state().inventory.find((item: any) => item.id === 10).count, 7);
  const added = state.state().inventory.find((item: any) => item.id === 11);
  assert.deepEqual(added, { type: 'craft_item', id: 11, name: 'Рунный булыжник', rarity_id: 0, rarity_display: 'Обычный', rarity_color: '#aaa', count: 6, itemType: 'upgrade', image: '/stone.webp' });
  assert.equal(state.state().bank, 10000);
  assert.deepEqual(state.state().writes, ['user', 'succeeded']);
});

test('отсутствие любого обязательного catalog item отклоняет всю выдачу', async () => {
  const state = repository({ items: [core], bank: 5 });
  const result = await processYooKassaCraftRarePayment(state.repo, input());
  assert.equal(result.status, 'rejected');
  assert.equal(state.state().bank, 5);
  assert.deepEqual(state.state().writes, []);
});

test('duplicate catalog name отклоняет всю выдачу как неоднозначную', async () => {
  const state = repository({ items: [core, { ...core, id: 12 }, stone], bank: 5 });
  const result = await processYooKassaCraftRarePayment(state.repo, input());
  assert.equal(result.status, 'rejected');
  assert.equal(state.state().bank, 5);
  assert.deepEqual(state.state().writes, []);
});

test('невалидный count существующего стака отклоняет всю выдачу', async () => {
  const state = repository({ inventory: JSON.stringify([{ type: 'craft_item', id: 10, count: 'broken' }]), bank: 5 });
  const result = await processYooKassaCraftRarePayment(state.repo, input());
  assert.equal(result.status, 'rejected');
  assert.equal(state.state().bank, 5);
  assert.deepEqual(state.state().writes, []);
});

test('повторный callback не меняет inventory или bank', async () => {
  const state = repository({ bank: 5 });
  await processYooKassaCraftRarePayment(state.repo, input());
  const first = structuredClone(state.state());
  const result = await processYooKassaCraftRarePayment(state.repo, input());
  assert.equal(result.status, 'already-processed');
  assert.deepEqual(state.state().inventory, first.inventory);
  assert.equal(state.state().bank, first.bank);
});

test('malformed inventory отклоняется без payment/user writes', async () => {
  const state = repository({ inventory: '{bad', bank: 5 });
  const result = await processYooKassaCraftRarePayment(state.repo, input());
  assert.equal(result.status, 'rejected');
  assert.equal(state.state().bank, 5);
  assert.deepEqual(state.state().writes, []);
});

test('provider mismatch отклоняется до user mutation', async () => {
  const state = repository({ bank: 5 });
  const result = await processYooKassaCraftRarePayment(state.repo, input({ verifiedAmount: '199.00' }));
  assert.equal(result.status, 'rejected');
  assert.equal(state.state().bank, 5);
  assert.deepEqual(state.state().writes, []);
});
