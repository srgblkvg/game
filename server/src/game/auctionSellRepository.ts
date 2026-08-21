import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { AuctionSellRepository, AuctionSellResult, AuctionSellTransaction } from './auctionSell';

function adapter(client: PoolClient): AuctionSellTransaction {
  return {
    async lockSeller(userId) {
      const row = (await client.query(
        'SELECT id, username, money, premiumuntil, inventory FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        username: String(row.username),
        money: Number(row.money),
        premiumUntil: Number(row.premiumuntil || 0),
        inventory: row.inventory || '[]',
      };
    },
    async countActiveLots(userId, now) {
      const row = (await client.query(
        'SELECT COUNT(*)::int AS count FROM auction_lots WHERE sellerid = $1 AND endsat > $2',
        [userId, now],
      )).rows[0];
      return Number(row?.count || 0);
    },
    async updateSeller(userId, money, inventory) {
      await client.query(
        'UPDATE users SET money = $1, inventory = $2 WHERE id = $3',
        [money, JSON.stringify(inventory), userId],
      );
    },
    async insertLot(data) {
      const row = (await client.query(
        `INSERT INTO auction_lots
         (sellerid, itemdata, startprice, buyoutprice, currentbid, duration, endsat, createdat)
         VALUES ($1, $2, $3, $4, NULL, $5, $6, $7) RETURNING id`,
        [data.sellerId, JSON.stringify(data.item), data.startPrice, data.buyoutPrice,
          data.duration, data.endsAt, data.createdAt],
      )).rows[0];
      return Number(row.id);
    },
    async addTreasuryCommission(amount, source) {
      await client.query(
        'UPDATE castle_treasury SET amount = amount + $1, updated_at = NOW() WHERE id = 1',
        [amount],
      );
      await client.query(
        'INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())',
        [amount, source],
      );
    },
    async insertSellMessage(data: AuctionSellResult) {
      const itemData = JSON.stringify({
        type: 'auction_lot', lotId: data.lotId, itemData: data.item,
        startPrice: data.startPrice, currentBid: null, buyoutPrice: data.buyoutPrice,
        currentBidderName: null, sellerName: data.sellerName,
        endsAt: data.endsAt, createdAt: Math.floor(new Date(data.createdAt).getTime() / 1000),
      });
      const row = (await client.query(
        `INSERT INTO chat_messages
         (senderid, targetid, content, item_data, senderguild, senderguildid)
         VALUES (0, NULL, $1, $2, NULL, NULL) RETURNING id`,
        [`📦 ${data.sellerName} выставил лот`, itemData],
      )).rows[0];
      return Number(row.id);
    },
  };
}

export function createPgAuctionSellRepository(): AuctionSellRepository {
  return { transaction: callback => db.tx(client => callback(adapter(client))) };
}
