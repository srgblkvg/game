import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { DungeonPayoutRepository, DungeonPayoutTransaction } from './dungeonPayout';

function adapter(client: PoolClient): DungeonPayoutTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        'SELECT id, inventory, money FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        inventory: row.inventory,
        money: Number(row.money || 0),
      } : null;
    },
    async saveUserReward(userId, money, inventory) {
      await client.query(
        'UPDATE users SET money = $1, inventory = $2 WHERE id = $3',
        [money, JSON.stringify(inventory), userId],
      );
    },
    async addSkillPage(userId, skillId) {
      await client.query(
        `INSERT INTO skill_pages (userid, skillid, count) VALUES ($1, $2, 1)
         ON CONFLICT (userid, skillid) DO UPDATE SET count = skill_pages.count + 1`,
        [userId, skillId],
      );
    },
    async updateRunProgress(userId, startedAt, maxFloor, maxReward) {
      await client.query(
        `UPDATE dungeon_runs
         SET startedat = $1,
             maxfloor = GREATEST(maxfloor, $2),
             maxreward = GREATEST(maxreward, $3)
         WHERE userid = $4`,
        [startedAt, maxFloor, maxReward, userId],
      );
    },
  };
}

export function createPgDungeonPayoutRepository(): DungeonPayoutRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
