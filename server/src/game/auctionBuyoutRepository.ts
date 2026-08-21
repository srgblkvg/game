import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type {
  AuctionBuyoutHistoryEntry,
  AuctionBuyoutMessage,
  AuctionBuyoutRepository,
  AuctionBuyoutTransaction,
  AuctionBuyoutLot,
} from './auctionBuyout';

function mapLot(row: any): AuctionBuyoutLot {
  return {
    id: Number(row.id),
    sellerId: Number(row.sellerid),
    currentBidderId: row.currentbidderid === null ? null : Number(row.currentbidderid),
    currentBid: row.currentbid === null ? null : Number(row.currentbid),
    buyoutPrice: row.buyoutprice === null ? null : Number(row.buyoutprice),
    itemData: row.itemdata,
    endsAt: Number(row.endsat),
  };
}

async function addOverflowItem(
  client: PoolClient,
  userId: number,
  item: Record<string, unknown>,
  auctionLotId: number,
): Promise<void> {
  const type = String(item.type || '');
  const isStack = type === 'craft_item' || type === 'material' || type === 'upgrade';
  if (isStack) {
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
    [userId, item, auctionLotId],
  );
}

function adapter(client: PoolClient): AuctionBuyoutTransaction {
  return {
    async lockActiveLot(lotId, now) {
      const row = (await client.query(
        `SELECT id, sellerid, currentbidderid, currentbid, buyoutprice, itemdata, endsat
         FROM auction_lots WHERE id = $1 AND endsat > $2 FOR UPDATE`,
        [lotId, now],
      )).rows[0];
      return row ? mapLot(row) : null;
    },
    async lockBuyer(userId) {
      const row = (await client.query(
        'SELECT id, money, username FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? { id: Number(row.id), money: Number(row.money), username: row.username } : null;
    },
    async getUsername(userId) {
      const row = (await client.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0];
      return row?.username ?? null;
    },
    async creditOverflowMoney(userId, amount) {
      await client.query(
        'UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + $1 WHERE id = $2',
        [amount, userId],
      );
    },
    addOverflowItem: (userId, item, lotId) => addOverflowItem(client, userId, item, lotId),
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
      await client.query(
        'UPDATE castle_treasury SET amount = amount + $1, updated_at = NOW() WHERE id = 1',
        [amount],
      );
      await client.query(
        'INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())',
        [amount, source],
      );
    },
    async insertHistory(entry: AuctionBuyoutHistoryEntry) {
      await client.query(
        `INSERT INTO auction_history
         (sellerid, buyerid, itemname, itemdata, price, commission, createdat)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [entry.sellerId, entry.buyerId, entry.itemName, entry.itemData, entry.price, entry.commission, entry.createdAt],
      );
    },
    async incrementSellerSales(userId) {
      await client.query(
        'UPDATE users SET auction_sales = COALESCE(auction_sales, 0) + 1 WHERE id = $1',
        [userId],
      );
    },
    async deleteAuctionMessages(lotId) {
      await client.query('DELETE FROM chat_messages WHERE item_data LIKE $1', [`%"lotId":${lotId}%`]);
    },
    async deleteLot(lotId) {
      await client.query('DELETE FROM auction_lots WHERE id = $1', [lotId]);
    },
    async insertBuyoutMessage(message: AuctionBuyoutMessage) {
      const itemData = JSON.stringify({
        type: 'auction_buyout',
        lotId: message.lotId,
        itemData: message.item,
        price: message.price,
        buyerName: message.buyerName,
        sellerName: message.sellerName,
      });
      const row = (await client.query(
        `INSERT INTO chat_messages
         (senderid, targetid, content, item_data, senderguild, senderguildid)
         VALUES (0, NULL, $1, $2, NULL, NULL) RETURNING id`,
        [`✅ ${message.buyerName} выкупил лот за ${message.price} серебра`, itemData],
      )).rows[0];
      return Number(row.id);
    },
  };
}

export function createPgAuctionBuyoutRepository(): AuctionBuyoutRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
