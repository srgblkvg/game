import assert from 'node:assert/strict';
import test from 'node:test';
import {
  settleExpiredAuctions,
  type AuctionSettlementEffects,
  type AuctionSettlementRepository,
  type AuctionSettlementTransaction,
  type ExpiredAuctionLot,
} from './auctionSettlement';

function lot(overrides: Partial<ExpiredAuctionLot> = {}): ExpiredAuctionLot {
  return {
    id: 10,
    sellerId: 1,
    currentBidderId: 2,
    currentBid: 1_001,
    itemData: JSON.stringify({ id: 7, name: 'Рунный камень', type: 'craft_item', count: 2 }),
    endsAt: 100,
    ...overrides,
  };
}

function harness(initial: ExpiredAuctionLot[], failCommit = false) {
  const lots = new Map(initial.map(entry => [entry.id, entry]));
  const calls: string[] = [];
  const events: string[] = [];

  const tx: AuctionSettlementTransaction = {
    async lockExpiredLot(id, now) {
      calls.push(`lock:${id}:${now}`);
      return lots.get(id) ?? null;
    },
    async creditOverflowMoney(userId, amount) { calls.push(`money:${userId}:${amount}`); },
    async addOverflowItem(userId, item, auctionLotId) { calls.push(`item:${userId}:${item.name}:${auctionLotId}`); },
    async insertHistory(entry) { calls.push(`history:${entry.sellerId}:${entry.buyerId}:${entry.price}:${entry.commission}`); },
    async addTreasuryCommission(amount: number, source: string) { calls.push(`treasury:${amount}:${source}`); },
    async incrementSellerTrade(userId) { calls.push(`sellerTrade:${userId}`); },
    async deleteAuctionMessages(lotId) { calls.push(`messages:${lotId}`); },
    async deleteLot(lotId) { calls.push(`delete:${lotId}`); lots.delete(lotId); },
    async getUsername(userId) { return userId === 2 ? 'Покупатель' : 'Игрок'; },
  };

  const repository: AuctionSettlementRepository = {
    async findExpiredLotIds() { return [...lots.keys()]; },
    async transaction(callback) {
      const result = await callback(tx);
      if (failCommit) throw new Error('commit failed');
      return result;
    },
  };

  const effects: AuctionSettlementEffects = {
    sold(result) { events.push(`sold:${result.lotId}:${result.sellerId}:${result.buyerId}`); },
    unsold(result) { events.push(`unsold:${result.lotId}:${result.sellerId}`); },
  };

  return { repository, effects, calls, events };
}

test('просроченный лот со ставкой рассчитывается и закрывается внутри транзакции', async () => {
  const h = harness([lot()]);
  const result = await settleExpiredAuctions(h.repository, h.effects, 101);

  assert.deepEqual(result, { settled: 1, skipped: 0, failed: 0 });
  assert.deepEqual(h.calls, [
    'lock:10:101',
    'money:1:901',
    'item:2:Рунный камень:10',
    'history:1:2:1001:100',
    'treasury:100:auction_expired',
    'sellerTrade:1',
    'messages:10',
    'delete:10',
  ]);
  assert.deepEqual(h.events, ['sold:10:1:2']);
});

test('непроданный просроченный лот возвращается продавцу без истории и выплаты', async () => {
  const h = harness([lot({ currentBidderId: null, currentBid: null })]);
  const result = await settleExpiredAuctions(h.repository, h.effects, 101);

  assert.deepEqual(result, { settled: 1, skipped: 0, failed: 0 });
  assert.deepEqual(h.calls, [
    'lock:10:101',
    'item:1:Рунный камень:10',
    'messages:10',
    'delete:10',
  ]);
  assert.deepEqual(h.events, ['unsold:10:1']);
});

test('эффекты не публикуются, если commit транзакции завершился ошибкой', async () => {
  const h = harness([lot()], true);
  const result = await settleExpiredAuctions(h.repository, h.effects, 101);

  assert.deepEqual(result, { settled: 0, skipped: 0, failed: 1 });
  assert.deepEqual(h.events, []);
});

test('повторная обработка уже закрытого лота безопасно пропускается', async () => {
  const h = harness([lot()]);
  await settleExpiredAuctions(h.repository, h.effects, 101);
  const repeated = await settleExpiredAuctions(h.repository, h.effects, 101);

  assert.deepEqual(repeated, { settled: 0, skipped: 0, failed: 0 });
  assert.deepEqual(h.events, ['sold:10:1:2']);
});
