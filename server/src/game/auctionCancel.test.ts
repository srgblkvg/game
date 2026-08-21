import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelAuctionLot,
  type AuctionCancelRepository,
  type AuctionCancelTransaction,
} from './auctionCancel';

function harness(options: { sellerId?: number; bidderId?: number | null; bid?: number | null; lotExists?: boolean } = {}) {
  const calls: string[] = [];
  const events: string[] = [];
  const tx: AuctionCancelTransaction = {
    async lockActiveLot(id, now) {
      calls.push(`lock:${id}:${now}`);
      if (options.lotExists === false) return null;
      return {
        id,
        sellerId: options.sellerId ?? 1,
        currentBidderId: options.bidderId === undefined ? 3 : options.bidderId,
        currentBid: options.bid === undefined ? 700 : options.bid,
        itemData: JSON.stringify({ id: 7, name: 'Камень', type: 'craft_item', count: 2 }),
      };
    },
    async addOverflowItem(id, item, lotId) { calls.push(`item:${id}:${item.name}:${lotId}`); },
    async creditOverflowMoney(id, amount) { calls.push(`refund:${id}:${amount}`); },
    async deleteAuctionMessages(id) { calls.push(`messages:${id}`); },
    async deleteLot(id) { calls.push(`delete:${id}`); },
  };
  const repository: AuctionCancelRepository = {
    async transaction(callback) { return callback(tx); },
  };
  return { repository, calls, events };
}

test('отмена атомарно возвращает предмет продавцу и ставку лидеру', async () => {
  const h = harness();
  const result = await cancelAuctionLot(h.repository, { committed: r => h.events.push(`done:${r.lotId}`) }, {
    lotId: 10, sellerId: 1, now: 150,
  });

  assert.equal(result.itemName, 'Камень');
  assert.deepEqual(h.calls, [
    'lock:10:150', 'item:1:Камень:10', 'refund:3:700', 'messages:10', 'delete:10',
  ]);
  assert.deepEqual(h.events, ['done:10']);
});

test('лот без ставки возвращает только предмет', async () => {
  const h = harness({ bidderId: null, bid: null });
  await cancelAuctionLot(h.repository, { committed() {} }, { lotId: 10, sellerId: 1, now: 150 });
  assert.deepEqual(h.calls, ['lock:10:150', 'item:1:Камень:10', 'messages:10', 'delete:10']);
});

test('чужой или отсутствующий лот отклоняется без изменений', async () => {
  const foreign = harness({ sellerId: 2 });
  await assert.rejects(
    cancelAuctionLot(foreign.repository, { committed() {} }, { lotId: 10, sellerId: 1, now: 150 }),
    /не ваш лот/,
  );
  assert.deepEqual(foreign.calls, ['lock:10:150']);

  const missing = harness({ lotExists: false });
  await assert.rejects(
    cancelAuctionLot(missing.repository, { committed() {} }, { lotId: 10, sellerId: 1, now: 150 }),
    /Лот не найден/,
  );
});
