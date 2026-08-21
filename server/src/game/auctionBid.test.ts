import assert from 'node:assert/strict';
import test from 'node:test';
import { placeAuctionBid, type AuctionBidRepository, type AuctionBidTransaction } from './auctionBid';

function harness(overrides: { currentBid?: number | null; bidderId?: number | null; money?: number } = {}) {
  const calls: string[] = [];
  const tx: AuctionBidTransaction = {
    async lockActiveLot() {
      calls.push('lot');
      return {
        id: 10, sellerId: 1, startPrice: 100, buyoutPrice: 500,
        currentBid: overrides.currentBid === undefined ? 200 : overrides.currentBid,
        currentBidderId: overrides.bidderId === undefined ? 3 : overrides.bidderId,
        itemData: JSON.stringify({ id: 7, name: 'Камень' }), endsAt: 300,
      };
    },
    async lockBidder(id) { calls.push(`bidder:${id}`); return { money: overrides.money ?? 1_000, username: 'Новый' }; },
    async getUsername(id) { return id === 3 ? 'Старый' : 'Продавец'; },
    async creditOverflowMoney(id, amount) { calls.push(`refund:${id}:${amount}`); },
    async debitBidder(id, amount) { calls.push(`debit:${id}:${amount}`); },
    async updateBid(id, amount, bidderId) { calls.push(`update:${id}:${amount}:${bidderId}`); },
    async insertBidMessage(message) { calls.push(`chat:${message.previousBidderName}`); return 99; },
  };
  const repository: AuctionBidRepository = { async transaction(callback) { return callback(tx); } };
  return { repository, calls };
}

test('ставка возвращает резерв прежнему лидеру и сохраняет его имя до обновления', async () => {
  const h = harness();
  const result = await placeAuctionBid(h.repository, { lotId: 10, bidderId: 2, amount: 210, now: 150 });
  assert.equal(result.previousBidderName, 'Старый');
  assert.equal(result.chatMessageId, 99);
  assert.deepEqual(h.calls, ['lot', 'bidder:2', 'refund:3:200', 'debit:2:210', 'update:10:210:2', 'chat:Старый']);
});

test('минимальная ставка равна стартовой или текущей плюс 5 процентов', async () => {
  await assert.rejects(placeAuctionBid(harness().repository, { lotId: 10, bidderId: 2, amount: 209, now: 150 }), /Мин. ставка: 210/);
  await assert.rejects(placeAuctionBid(harness({ currentBid: null, bidderId: null }).repository, { lotId: 10, bidderId: 2, amount: 99, now: 150 }), /Мин. ставка: 100/);
});

test('свой лот и недостаток серебра отклоняются до списаний', async () => {
  const own = harness();
  const original = own.repository;
  const wrapped: AuctionBidRepository = { transaction: cb => original.transaction(async tx => {
    const base = await tx.lockActiveLot(10, 150);
    return cb({ ...tx, lockActiveLot: async () => ({ ...base!, sellerId: 2 }) });
  }) };
  await assert.rejects(placeAuctionBid(wrapped, { lotId: 10, bidderId: 2, amount: 210, now: 150 }), /свой лот/);
  await assert.rejects(placeAuctionBid(harness({ money: 100 }).repository, { lotId: 10, bidderId: 2, amount: 210, now: 150 }), /Недостаточно монет/);
});
