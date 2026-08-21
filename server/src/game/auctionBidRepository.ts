import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { AuctionBidRepository, AuctionBidTransaction } from './auctionBid';

function adapter(client: PoolClient): AuctionBidTransaction {
  return {
    async lockActiveLot(lotId, now) {
      const row = (await client.query(
        `SELECT id, sellerid, startprice, buyoutprice, currentbid,
                currentbidderid, itemdata, endsat
         FROM auction_lots WHERE id = $1 AND endsat > $2 FOR UPDATE`,
        [lotId, now],
      )).rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        sellerId: Number(row.sellerid),
        startPrice: Number(row.startprice),
        buyoutPrice: row.buyoutprice === null ? null : Number(row.buyoutprice),
        currentBid: row.currentbid === null ? null : Number(row.currentbid),
        currentBidderId: row.currentbidderid === null ? null : Number(row.currentbidderid),
        itemData: row.itemdata,
        endsAt: Number(row.endsat),
      };
    },
    async lockBidder(userId) {
      const row = (await client.query(
        'SELECT money, username FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? { money: Number(row.money), username: row.username } : null;
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
    async debitBidder(userId, amount) {
      await client.query(
        'UPDATE users SET money = money - $1 WHERE id = $2',
        [amount, userId],
      );
    },
    async updateBid(lotId, amount, bidderId) {
      await client.query(
        'UPDATE auction_lots SET currentbid = $1, currentbidderid = $2 WHERE id = $3',
        [amount, bidderId, lotId],
      );
    },
    async insertBidMessage(message) {
      const itemData = JSON.stringify({
        type: 'auction_bid',
        lotId: message.lotId,
        itemData: message.item,
        startPrice: message.startPrice,
        currentBid: message.currentBid,
        buyoutPrice: message.buyoutPrice,
        currentBidderName: message.bidderName,
        previousBidderName: message.previousBidderName,
        sellerName: message.sellerName,
        endsAt: message.endsAt,
        createdAt: Math.floor(Date.parse(message.createdAt) / 1000),
      });
      const row = (await client.query(
        `INSERT INTO chat_messages
         (senderid, targetid, content, item_data, senderguild, senderguildid)
         VALUES (0, NULL, $1, $2, NULL, NULL) RETURNING id`,
        [`💰 ${message.bidderName} перебил ставку`, itemData],
      )).rows[0];
      return Number(row.id);
    },
  };
}

export function createPgAuctionBidRepository(): AuctionBidRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
