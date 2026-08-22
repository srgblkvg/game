import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { TutorialRewardRepository, TutorialRewardTransaction } from './tutorialRewards';

function adapter(client: PoolClient): TutorialRewardTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        `SELECT id, tutorial_step, tutorial_completed, money, inventory
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        tutorialStep: Number(row.tutorial_step || 0),
        tutorialCompleted: Number(row.tutorial_completed || 0),
        money: Number(row.money || 0),
        inventory: row.inventory,
      } : null;
    },
    async savePveReward(userId, inventory, money, tutorialStep, lastPveAttackTime) {
      await client.query(
        `UPDATE users SET inventory = $1, money = $2, tutorial_step = $3,
         lastpveattacktime = $4 WHERE id = $5`,
        [JSON.stringify(inventory), money, tutorialStep, lastPveAttackTime, userId],
      );
    },
    async saveCraftReward(userId, inventory, tutorialStep) {
      await client.query(
        'UPDATE users SET inventory = $1, tutorial_step = $2 WHERE id = $3',
        [JSON.stringify(inventory), tutorialStep, userId],
      );
    },
    async saveCompletion(userId, money, tutorialStep, completed) {
      await client.query(
        `UPDATE users SET money = $1, tutorial_step = $2, tutorial_completed = $3
         WHERE id = $4`,
        [money, tutorialStep, completed, userId],
      );
    },
  };
}

export function createPgTutorialRewardRepository(): TutorialRewardRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
