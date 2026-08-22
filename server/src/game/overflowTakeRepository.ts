import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { OverflowTakeRepository, OverflowTakeTransaction } from './overflowTake';

function adapter(client: PoolClient): OverflowTakeTransaction {
  return {
    async lockOverflowItem(id, userId) {
      const row = (await client.query(
        `SELECT id, userid, item
         FROM overflow_storage
         WHERE id = $1 AND userid = $2
         FOR UPDATE`,
        [id, userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        userId: Number(row.userid),
        item: row.item,
      } : null;
    },
    async lockUser(userId) {
      const row = (await client.query(
        `SELECT id, inventory, inventoryslots
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        inventory: row.inventory,
        inventorySlots: Number(row.inventoryslots || 10),
      } : null;
    },
    async saveInventory(userId, inventory) {
      await client.query(
        'UPDATE users SET inventory = $1 WHERE id = $2',
        [JSON.stringify(inventory), userId],
      );
    },
    async deleteOverflowItem(id, userId) {
      await client.query(
        'DELETE FROM overflow_storage WHERE id = $1 AND userid = $2',
        [id, userId],
      );
    },
  };
}

export function createPgOverflowTakeRepository(): OverflowTakeRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
