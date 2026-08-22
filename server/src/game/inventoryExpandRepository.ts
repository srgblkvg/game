import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { InventoryExpandRepository, InventoryExpandTransaction } from './inventoryExpand';

function adapter(client: PoolClient): InventoryExpandTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        'SELECT id, inventoryslots, money FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        inventorySlots: Number(row.inventoryslots || 10),
        money: Number(row.money || 0),
      } : null;
    },
    async saveExpansion(userId, inventorySlots, money) {
      await client.query(
        'UPDATE users SET inventoryslots = $1, money = $2 WHERE id = $3',
        [inventorySlots, money, userId],
      );
    },
  };
}

export function createPgInventoryExpandRepository(): InventoryExpandRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
