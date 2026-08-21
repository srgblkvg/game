import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buyoutAuctionLot,
  type AuctionBuyoutEffects,
  type AuctionBuyoutLot,
  type AuctionBuyoutRepository,
  type AuctionBuyoutTransaction,
} from './auctionBuyout';

function lot(overrides: Partial<AuctionBuyoutLot> = {}): AuctionBuyoutLot {
  return {
    id: 10,
    sellerId: 1,
    currentBidderId: 3,
    currentBid: 700,
    buyoutPrice: 1_001,
    itemData: JSON.stringify({ id: 7, name: 'Рунный камень', type: 'craft_item', count: 2 }),
    endsAt: 200,
    ...overrides,
  };
}

function harness(options: { lot?: AuctionBuyoutLot | null; buyerMoney?: number; failCommit?: boolean } = {}) {
  const calls: string[] = [];
  const events: string[] = [];
  let availableLot = options.lot === undefined ? lot() : options.lot;
  const buyerMoney = options.buyerMoney ?? 2_000;

  const tx: AuctionBuyoutTransaction = {
    async lockActiveLot(id, now) { calls.push(`lock:${id}:${now}`); return availableLot; },
    async lockBuyer(id) { calls.push(`buyer:${id}`); return { id, money: buyerMoney, username: 'Покупатель' }; },
    async getUsername(id) { return id === 1 ? 'Продавец' : 'Игрок'; },
    async creditOverflowMoney(id, amount) { calls.push(`refund:${id}:${amount}`); },
    async addOverflowItem(id, item, lotId) { calls.push(`item:${id}:${item.name}:${lotId}`); },
    async debitBuyer(id, amount) { calls.push(`debit:${id}:${amount}`); },
    async creditSeller(id, amount) { calls.push(`seller:${id}:${amount}`); },
    async addTreasuryCommission(amount, source) { calls.push(`treasury:${amount}:${source}`); },
    async insertHistory(entry) { calls.push(`history:${entry.sellerId}:${entry.buyerId}:${entry.price}:${entry.commission}`); },
    async incrementSellerSales(id) { calls.push(`sales:${id}`); },
    async deleteAuctionMessages(id) { calls.push(`messages:${id}`); },
    async deleteLot(id) { calls.push(`delete:${id}`); availableLot = null; },
    async insertBuyoutMessage(message) { calls.push(`chat:${message.lotId}:${message.price}`); return 99; },
  };

  const repository: AuctionBuyoutRepository = {
    async transaction(callback) {
      const result = await callback(tx);
      if (options.failCommit) throw new Error('commit failed');
      return result;
    },
  };
  const effects: AuctionBuyoutEffects = {
    committed(result) { events.push(`committed:${result.lotId}:${result.buyerId}:${result.sellerId}`); },
  };
  return { repository, effects, calls, events };
}

test('полный выкуп атомарно переносит деньги, предмет, историю и чат', async () => {
  const h = harness();
  const result = await buyoutAuctionLot(h.repository, h.effects, { lotId: 10, buyerId: 2, now: 150 });

  assert.equal(result.price, 1_001);
  assert.equal(result.commission, 100);
  assert.equal(result.payout, 901);
  assert.equal(result.chatMessageId, 99);
  assert.deepEqual(h.calls, [
    'lock:10:150', 'buyer:2', 'refund:3:700', 'item:2:Рунный камень:10',
    'debit:2:1001', 'seller:1:901', 'treasury:100:auction_buyout',
    'history:1:2:1001:100', 'sales:1', 'messages:10', 'delete:10', 'chat:10:1001',
  ]);
  assert.deepEqual(h.events, ['committed:10:2:1']);
});

test('недостаток серебра отклоняет выкуп без изменений', async () => {
  const h = harness({ buyerMoney: 1_000 });
  await assert.rejects(
    buyoutAuctionLot(h.repository, h.effects, { lotId: 10, buyerId: 2, now: 150 }),
    /Недостаточно монет/,
  );
  assert.deepEqual(h.calls, ['lock:10:150', 'buyer:2']);
  assert.deepEqual(h.events, []);
});

test('нельзя выкупить свой, истёкший или лот без цены выкупа', async () => {
  const own = harness({ lot: lot({ sellerId: 2 }) });
  await assert.rejects(buyoutAuctionLot(own.repository, own.effects, { lotId: 10, buyerId: 2, now: 150 }), /свой лот/);

  const missing = harness({ lot: null });
  await assert.rejects(buyoutAuctionLot(missing.repository, missing.effects, { lotId: 10, buyerId: 2, now: 150 }), /Лот не найден/);

  const noBuyout = harness({ lot: lot({ buyoutPrice: null }) });
  await assert.rejects(buyoutAuctionLot(noBuyout.repository, noBuyout.effects, { lotId: 10, buyerId: 2, now: 150 }), /нет выкупа/);
});

test('эффекты не публикуются при ошибке commit', async () => {
  const h = harness({ failCommit: true });
  await assert.rejects(
    buyoutAuctionLot(h.repository, h.effects, { lotId: 10, buyerId: 2, now: 150 }),
    /commit failed/,
  );
  assert.deepEqual(h.events, []);
});

test('ошибка post-commit эффекта не превращает совершённый выкуп в ошибку операции', async () => {
  const h = harness();
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await buyoutAuctionLot(h.repository, {
      committed() { throw new Error('websocket failed'); },
    }, { lotId: 10, buyerId: 2, now: 150 });

    assert.equal(result.lotId, 10);
    assert.ok(h.calls.includes('delete:10'));
  } finally {
    console.error = originalError;
  }
});
