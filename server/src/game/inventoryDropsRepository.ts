import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { InventoryDropRepository, InventoryDropTransaction } from './inventoryDrops';

function adapter(client: PoolClient): InventoryDropTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        'SELECT id, inventory FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? { id: Number(row.id), inventory: row.inventory } : null;
    },
    async saveInventory(userId, inventory) {
      await client.query(
        'UPDATE users SET inventory = $1 WHERE id = $2',
        [JSON.stringify(inventory), userId],
      );
    },
  };
}

export function createPgInventoryDropRepository(): InventoryDropRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
