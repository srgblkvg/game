import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePartialPurchase,
  purchasePartialAuctionLot,
  type PartialPurchaseRepository,
  type PartialPurchaseTransaction,
} from './auctionPartial';

const stack = {
  startPrice: 1_000,
  buyoutPrice: 2_003,
  currentBid: 1_503,
  currentBidderId: 3,
  stackCount: 10,
};

test('частичная покупка использует округлённую вверх цену единицы и пересчитывает остаток', () => {
  assert.deepEqual(calculatePartialPurchase(stack, 3), {
    quantity: 3,
    remainingCount: 7,
    pricePerItem: 201,
    cost: 603,
    commission: 60,
    payout: 543,
    newStartPrice: 700,
    newBuyoutPrice: 1_402,
    newCurrentBid: 1_052,
    bidderRefund: 451,
    removeLot: false,
  });
});

test('покупка всего стека удаляет лот и возвращает лидеру всю ставку', () => {
  assert.deepEqual(calculatePartialPurchase(stack, 10), {
    quantity: 10,
    remainingCount: 0,
    pricePerItem: 201,
    cost: 2_010,
    commission: 201,
    payout: 1_809,
    newStartPrice: null,
    newBuyoutPrice: null,
    newCurrentBid: null,
    bidderRefund: 1_503,
    removeLot: true,
  });
});

test('лот без ставки не создаёт возврат лидеру', () => {
  const result = calculatePartialPurchase({ ...stack, currentBid: null, currentBidderId: null }, 2);
  assert.equal(result.bidderRefund, 0);
  assert.equal(result.newCurrentBid, null);
});

test('неверное количество отклоняется до любых денежных операций', () => {
  assert.throws(() => calculatePartialPurchase(stack, 0), /количество/);
  assert.throws(() => calculatePartialPurchase(stack, 11), /В лоте только 10/);
  assert.throws(() => calculatePartialPurchase({ ...stack, stackCount: 1 }, 1), /нельзя купить частично/);
});

test('транзакционный сервис переносит все денежные и предметные операции в одну callback', async () => {
  const calls: string[] = [];
  const tx: PartialPurchaseTransaction = {
    async lockActiveLot() {
      calls.push('lockLot');
      return {
        id: 10, sellerId: 1, currentBidderId: 3, currentBid: 1_503,
        buyoutPrice: 2_003, startPrice: 1_000, stackCount: 10,
        itemData: JSON.stringify({ id: 7, name: 'Камень', type: 'craft_item', count: 10 }),
      };
    },
    async lockBuyer() { calls.push('lockBuyer'); return { money: 10_000 }; },
    async addOverflowItem() { calls.push('item'); },
    async updateLot() { calls.push('updateLot'); },
    async deleteLot() { calls.push('deleteLot'); },
    async deleteAuctionMessages() { calls.push('messages'); },
    async creditOverflowMoney(_id: number, amount: number) { calls.push(`refund:${amount}`); },
    async debitBuyer(_id: number, amount: number) { calls.push(`debit:${amount}`); },
    async creditSeller(_id: number, amount: number) { calls.push(`seller:${amount}`); },
    async addTreasuryCommission(amount: number) { calls.push(`treasury:${amount}`); },
    async insertHistory() { calls.push('history'); },
  };
  const repository: PartialPurchaseRepository = {
    async transaction<T>(callback: (transaction: PartialPurchaseTransaction) => Promise<T>) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };

  const result = await purchasePartialAuctionLot(repository, { lotId: 10, buyerId: 2, quantity: 3, now: 150 });
  assert.equal(result.remainingCount, 7);
  assert.deepEqual(calls, [
    'begin', 'lockLot', 'lockBuyer', 'item', 'updateLot', 'refund:451',
    'debit:603', 'seller:543', 'treasury:60', 'history', 'commit',
  ]);
});
