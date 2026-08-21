import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { AuctionCancelRepository, AuctionCancelTransaction } from './auctionCancel';

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

function adapter(client: PoolClient): AuctionCancelTransaction {
  return {
    async lockActiveLot(lotId, now) {
      const row = (await client.query(
        `SELECT id, sellerid, currentbidderid, currentbid, itemdata
         FROM auction_lots WHERE id = $1 AND endsat > $2 FOR UPDATE`,
        [lotId, now],
      )).rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        sellerId: Number(row.sellerid),
        currentBidderId: row.currentbidderid === null ? null : Number(row.currentbidderid),
        currentBid: row.currentbid === null ? null : Number(row.currentbid),
        itemData: row.itemdata,
      };
    },
    addOverflowItem: (userId, item, lotId) => addOverflowItem(client, userId, item, lotId),
    async creditOverflowMoney(userId, amount) {
      await client.query(
        'UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + $1 WHERE id = $2',
        [amount, userId],
      );
    },
    async deleteAuctionMessages(lotId) {
      await client.query('DELETE FROM chat_messages WHERE item_data LIKE $1', [`%"lotId":${lotId}%`]);
    },
    async deleteLot(lotId) {
      await client.query('DELETE FROM auction_lots WHERE id = $1', [lotId]);
    },
  };
}

export function createPgAuctionCancelRepository(): AuctionCancelRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
