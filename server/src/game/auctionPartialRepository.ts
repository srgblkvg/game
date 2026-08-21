import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type {
  PartialAuctionLot,
  PartialPurchaseRepository,
  PartialPurchaseTransaction,
  PartialPurchasePlan,
} from './auctionPartial';

function mapLot(row: any): PartialAuctionLot {
  return {
    id: Number(row.id),
    sellerId: Number(row.sellerid),
    currentBidderId: row.currentbidderid === null ? null : Number(row.currentbidderid),
    currentBid: row.currentbid === null ? null : Number(row.currentbid),
    buyoutPrice: row.buyoutprice === null ? null : Number(row.buyoutprice),
    startPrice: Number(row.startprice),
    stackCount: 0,
    itemData: row.itemdata,
  };
}

async function addOverflowItem(client: PoolClient, userId: number, item: Record<string, unknown>, lotId: number) {
  const type = String(item.type || '');
  const stackable = type === 'craft_item' || type === 'material' || type === 'upgrade';
  if (stackable) {
    const existing = (await client.query(
      `SELECT id, item FROM overflow_storage
       WHERE userid = $1 AND item->>'id' = $2 AND item->>'type' = $3
       LIMIT 1 FOR UPDATE`,
      [userId, String(item.id), type],
    )).rows[0] as any;
    if (existing) {
      const current = typeof existing.item === 'string' ? JSON.parse(existing.item) : existing.item;
      current.count = Number(current.count || 0) + Number(item.count || 1);
      await client.query('UPDATE overflow_storage SET item = $1::jsonb WHERE id = $2', [current, existing.id]);
      return;
    }
  }
  await client.query(
    'INSERT INTO overflow_storage (userid, item, auctionlotid) VALUES ($1, $2::jsonb, $3)',
    [userId, item, lotId],
  );
}

function adapter(client: PoolClient): PartialPurchaseTransaction {
  return {
    async lockActiveLot(lotId, now) {
      const row = (await client.query(
        `SELECT id, sellerid, currentbidderid, currentbid, buyoutprice,
                startprice, itemdata
         FROM auction_lots WHERE id = $1 AND endsat > $2 FOR UPDATE`,
        [lotId, now],
      )).rows[0];
      return row ? mapLot(row) : null;
    },
    async lockBuyer(userId) {
      const row = (await client.query('SELECT money FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
      return row ? { money: Number(row.money) } : null;
    },
    addOverflowItem: (userId, item, lotId) => addOverflowItem(client, userId, item, lotId),
    async updateLot(lotId, item, plan: PartialPurchasePlan) {
      await client.query(
        `UPDATE auction_lots
         SET itemdata = $1, startprice = $2, buyoutprice = $3, currentbid = $4
         WHERE id = $5`,
        [JSON.stringify(item), plan.newStartPrice, plan.newBuyoutPrice, plan.newCurrentBid, lotId],
      );
    },
    async deleteLot(lotId) {
      await client.query('DELETE FROM auction_lots WHERE id = $1', [lotId]);
    },
    async deleteAuctionMessages(lotId) {
      await client.query('DELETE FROM chat_messages WHERE item_data LIKE $1', [`%"lotId":${lotId}%`]);
    },
    async creditOverflowMoney(userId, amount) {
      await client.query(
        'UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + $1 WHERE id = $2',
        [amount, userId],
      );
    },
    async debitBuyer(userId, amount) {
      await client.query(
        'UPDATE users SET money = money - $1, auctiontrades = auctiontrades + 1 WHERE id = $2',
        [amount, userId],
      );
    },
    async creditSeller(userId, amount) {
      await client.query(
        `UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + $1,
         auctiontrades = auctiontrades + 1 WHERE id = $2`,
        [amount, userId],
      );
    },
    async addTreasuryCommission(amount, source) {
      if (amount <= 0) return;
      await client.query('UPDATE castle_treasury SET amount = amount + $1, updated_at = NOW() WHERE id = 1', [amount]);
      await client.query('INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())', [amount, source]);
    },
    async insertHistory(entry) {
      await client.query(
        `INSERT INTO auction_history
         (sellerid, buyerid, itemname, itemdata, price, commission, createdat)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [entry.sellerId, entry.buyerId, entry.itemName, entry.itemData, entry.price, entry.commission, entry.createdAt],
      );
    },
  };
}

export function createPgAuctionPartialRepository(): PartialPurchaseRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
