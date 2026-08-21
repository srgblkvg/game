import assert from 'node:assert/strict';
import test from 'node:test';
import { sellAuctionLot, type AuctionSeller, type AuctionSellRepository, type AuctionSellTransaction } from './auctionSell';

function harness(overrides: Partial<AuctionSeller> = {}) {
  const calls: string[] = [];
  const seller: AuctionSeller = { id: 1, username: 'Продавец', money: 10_000, premiumUntil: 0,
    inventory: [{ id: 7, name: 'Настоящий предмет', type: 'craft_item', rarity_id: 0, count: 5 }], ...overrides };
  const tx: AuctionSellTransaction = {
    async lockSeller(id) { calls.push(`lock:${id}`); return seller; },
    async countActiveLots() { calls.push('count'); return 0; },
    async updateSeller(_id, money, inventory) { calls.push(`seller:${money}:${JSON.stringify(inventory)}`); },
    async insertLot(data) { calls.push(`lot:${data.item.name}:${data.item.count}:${data.startPrice}`); return 42; },
    async addTreasuryCommission(amount, source) { calls.push(`treasury:${amount}:${source}`); },
    async insertSellMessage() { calls.push('message'); return 99; },
  };
  const repository: AuctionSellRepository = { async transaction(callback) { return callback(tx); } };
  return { repository, calls };
}

test('sell берёт предмет из серверного инвентаря и атомарно выставляет часть стека', async () => {
  const h = harness();
  const result = await sellAuctionLot(h.repository, { sellerId: 1, itemId: 7, startPrice: 10, buyoutPrice: 30, count: 2, duration: 6, now: 100 });
  assert.equal(result.lotId, 42);
  assert.deepEqual(h.calls, [
    'lock:1', 'count', 'seller:9999:[{"id":7,"name":"Настоящий предмет","type":"craft_item","rarity_id":0,"count":3}]',
    'lot:Настоящий предмет:2:20', 'treasury:1:auction_listing', 'message',
  ]);
});

test('sell отклоняет подменённый itemId до денежных операций', async () => {
  const h = harness();
  await assert.rejects(() => sellAuctionLot(h.repository, { sellerId: 1, itemId: 999, startPrice: 10, now: 100 }), /не найден/);
  assert.deepEqual(h.calls, ['lock:1', 'count']);
});

test('sell не позволяет выставить заблокированный предмет', async () => {
  const h = harness({ inventory: [{ id: 7, locked: true, type: 'item', rarity_id: 0 }] });
  await assert.rejects(() => sellAuctionLot(h.repository, { sellerId: 1, itemId: 7, startPrice: 10, now: 100 }), /заблокирован/);
  assert.deepEqual(h.calls, ['lock:1', 'count']);
});

test('sell отбрасывает неподдерживаемую длительность к безопасному значению 24 часа', async () => {
  const h = harness();
  const result = await sellAuctionLot(h.repository, { sellerId: 1, itemId: 7, startPrice: 10, duration: 999, now: 100 });
  assert.equal(result.duration, 24);
});

test('sell отклоняет нулевой серверный стек и дробное количество', async () => {
  const empty = harness({ inventory: [{ id: 7, type: 'craft_item', rarity_id: 0, count: 0 }] });
  await assert.rejects(
    () => sellAuctionLot(empty.repository, { sellerId: 1, itemId: 7, startPrice: 10, count: 1, now: 100 }),
    /количество/,
  );
  const fractional = harness();
  await assert.rejects(
    () => sellAuctionLot(fractional.repository, { sellerId: 1, itemId: 7, startPrice: 10, count: 1.5, now: 100 }),
    /количество/,
  );
});

test('sell отклоняет NaN, Infinity и дробные цены', async () => {
  for (const startPrice of [NaN, Infinity, 10.5]) {
    const h = harness();
    await assert.rejects(
      () => sellAuctionLot(h.repository, { sellerId: 1, itemId: 7, startPrice, count: 1, now: 100 }),
      /цена/,
    );
  }
  const h = harness();
  await assert.rejects(
    () => sellAuctionLot(h.repository, { sellerId: 1, itemId: 7, startPrice: 10, buyoutPrice: Infinity, count: 1, now: 100 }),
    /цена/,
  );
});
