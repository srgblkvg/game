import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { TutorialProgressRepository, TutorialProgressTransaction } from './tutorialProgress';

function adapter(client: PoolClient): TutorialProgressTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        `SELECT id, tutorial_step, active_equip_slot, equipment,
                equipment_1, equipment_2, equipment_3
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        tutorialStep: Number(row.tutorial_step || 0),
        activeEquipSlot: Number(row.active_equip_slot || 1),
        equipment: row.equipment,
        equipment1: row.equipment_1,
        equipment2: row.equipment_2,
        equipment3: row.equipment_3,
      } : null;
    },
    async saveStep(userId, step) {
      await client.query('UPDATE users SET tutorial_step = $1 WHERE id = $2', [step, userId]);
    },
    async saveArenaStep(userId, step, lastPvpTime) {
      await client.query(
        'UPDATE users SET tutorial_step = $1, lastpvptime = $2 WHERE id = $3',
        [step, lastPvpTime, userId],
      );
    },
  };
}

export function createPgTutorialProgressRepository(): TutorialProgressRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
