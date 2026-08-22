import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { CollectionAddRepository, CollectionAddTransaction } from './collectionAdd';

function adapter(client: PoolClient): CollectionAddTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        'SELECT id, inventory FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? { id: Number(row.id), inventory: row.inventory } : null;
    },
    async isCollectionSetItem(itemName, slot, rarityId) {
      const row = (await client.query(
        `SELECT 1 FROM collection_set_items
         WHERE item_name = $1 AND slot = $2 AND rarity_id = $3
         LIMIT 1`,
        [itemName, slot, rarityId],
      )).rows[0];
      return Boolean(row);
    },
    async hasCollectionItem(userId, itemName, slot, rarityId, plusTab) {
      const row = (await client.query(
        `SELECT 1 FROM collections
         WHERE userid = $1 AND itemname = $2 AND slot = $3 AND rarity_id = $4
           AND upgradelevel ${plusTab ? '>= 7' : '< 7'}
         LIMIT 1`,
        [userId, itemName, slot, rarityId],
      )).rows[0];
      return Boolean(row);
    },
    async saveInventory(userId, inventory) {
      await client.query(
        'UPDATE users SET inventory = $1 WHERE id = $2',
        [JSON.stringify(inventory), userId],
      );
    },
    async insertCollectionItem(userId, itemName, slot, rarityId, upgradeLevel) {
      await client.query(
        `INSERT INTO collections (userid, itemname, slot, rarity_id, upgradelevel)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, itemName, slot, rarityId, upgradeLevel],
      );
    },
  };
}

export function createPgCollectionAddRepository(): CollectionAddRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
