import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type {
  AuctionHistoryEntry,
  AuctionSettlementRepository,
  AuctionSettlementTransaction,
  ExpiredAuctionLot,
} from './auctionSettlement';

function mapLot(row: any): ExpiredAuctionLot {
  return {
    id: Number(row.id),
    sellerId: Number(row.sellerid),
    currentBidderId: row.currentbidderid === null ? null : Number(row.currentbidderid),
    currentBid: row.currentbid === null ? null : Number(row.currentbid),
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

function transactionAdapter(client: PoolClient): AuctionSettlementTransaction {
  return {
    async lockExpiredLot(lotId, now) {
      const row = (await client.query(
        `SELECT id, sellerid, currentbidderid, currentbid, itemdata, endsat
         FROM auction_lots WHERE id = $1 AND endsat <= $2 FOR UPDATE`,
        [lotId, now],
      )).rows[0];
      return row ? mapLot(row) : null;
    },
    async creditOverflowMoney(userId, amount) {
      await client.query(
        'UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + $1 WHERE id = $2',
        [amount, userId],
      );
    },
    addOverflowItem: (userId, item, lotId) => addOverflowItem(client, userId, item, lotId),
    async insertHistory(entry: AuctionHistoryEntry) {
      await client.query(
        `INSERT INTO auction_history
         (sellerid, buyerid, itemname, itemdata, price, commission, createdat)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [entry.sellerId, entry.buyerId, entry.itemName, entry.itemData, entry.price, entry.commission, entry.createdAt],
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
    async incrementSellerTrade(userId) {
      await client.query(
        `UPDATE users SET auctiontrades = auctiontrades + 1,
         auction_sales = COALESCE(auction_sales, 0) + 1 WHERE id = $1`,
        [userId],
      );
    },
    async deleteAuctionMessages(lotId) {
      await client.query('DELETE FROM chat_messages WHERE item_data LIKE $1', [`%"lotId":${lotId}%`]);
    },
    async deleteLot(lotId) {
      await client.query('DELETE FROM auction_lots WHERE id = $1', [lotId]);
    },
    async getUsername(userId) {
      const row = (await client.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0];
      return row?.username ?? null;
    },
  };
}

export function createPgAuctionSettlementRepository(): AuctionSettlementRepository {
  return {
    async findExpiredLotIds(now) {
      const result = await db.raw(
        'SELECT id FROM auction_lots WHERE endsat <= $1 ORDER BY id LIMIT 100',
        [now],
      );
      return result.rows.map(row => Number(row.id));
    },
    transaction(callback) {
      return db.tx(client => callback(transactionAdapter(client)));
    },
  };
}
