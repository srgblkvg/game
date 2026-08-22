import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { InventorySalvageRepository, InventorySalvageTransaction } from './inventorySalvage';

function adapter(client: PoolClient): InventorySalvageTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        'SELECT id, inventory FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? { id: Number(row.id), inventory: row.inventory } : null;
    },
    async findMaterial(rarityId) {
      const row = (await client.query(
        `SELECT c.id, c.name, c.rarity_id, c.type, c.image,
                r.display_name AS rarity_display, r.color AS rarity_color
         FROM craft_items c
         JOIN rarities r ON c.rarity_id = r.id
         WHERE c.rarity_id = $1
         LIMIT 1`,
        [rarityId],
      )).rows[0];
      return row ? {
        id: row.id,
        name: row.name,
        rarityId: Number(row.rarity_id),
        type: row.type,
        image: row.image,
        rarityDisplay: row.rarity_display,
        rarityColor: row.rarity_color,
      } : null;
    },
    async saveInventory(userId, inventory) {
      await client.query(
        'UPDATE users SET inventory = $1 WHERE id = $2',
        [JSON.stringify(inventory), userId],
      );
    },
  };
}

export function createPgInventorySalvageRepository(): InventorySalvageRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
