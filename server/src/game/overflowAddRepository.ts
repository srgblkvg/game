import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { OverflowAddRepository, OverflowAddTransaction } from './overflowAdd';

function adapter(client: PoolClient): OverflowAddTransaction {
  return {
    async lockUser(userId) {
      return Boolean((await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0]);
    },
    async lockStack(userId, itemId, type) {
      const row = (await client.query(
        `SELECT id, item FROM overflow_storage
         WHERE userid = $1 AND item->>'id' = $2 AND item->>'type' = $3
         ORDER BY id LIMIT 1 FOR UPDATE`,
        [userId, itemId, type],
      )).rows[0];
      return row ? { id: Number(row.id), item: row.item } : null;
    },
    async updateStack(id, item) {
      const result = await client.query(
        'UPDATE overflow_storage SET item = $1::jsonb WHERE id = $2',
        [item, id],
      );
      if (result.rowCount !== 1) throw new Error('Складской предмет изменился во время операции');
    },
    async insertItem(userId, item, auctionLotId) {
      await client.query(
        'INSERT INTO overflow_storage (userid, item, auctionlotid) VALUES ($1, $2::jsonb, $3)',
        [userId, item, auctionLotId ?? null],
      );
    },
  };
}

export function createPgOverflowAddRepository(): OverflowAddRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
