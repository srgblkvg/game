import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { EquipmentSwitchRepository, EquipmentSwitchTransaction } from './inventoryEquipSwitch';

const equipmentColumn: Record<number, 'equipment_1' | 'equipment_2' | 'equipment_3'> = {
  1: 'equipment_1',
  2: 'equipment_2',
  3: 'equipment_3',
};

function parseEquipment(value: unknown): Record<string, any> {
  if (typeof value === 'string') {
    try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function adapter(client: PoolClient): EquipmentSwitchTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        `SELECT id, equipment, equipment_1, equipment_2, equipment_3, active_equip_slot
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      if (!row) return null;
      const rawSlot = Number(row.active_equip_slot || 1);
      const activeEquipSlot = equipmentColumn[rawSlot] ? rawSlot : 1;
      return {
        id: Number(row.id),
        activeEquipSlot,
        equipment: parseEquipment(row.equipment),
        equipmentSets: {
          1: parseEquipment(row.equipment_1),
          2: parseEquipment(row.equipment_2),
          3: parseEquipment(row.equipment_3),
        },
      };
    },
    async saveSwitch(state) {
      const oldColumn = equipmentColumn[state.oldSlot];
      if (!oldColumn || !equipmentColumn[state.newSlot]) throw new Error('Неверный слот');
      await client.query(
        `UPDATE users SET ${oldColumn} = $1::jsonb, equipment = $2, active_equip_slot = $3 WHERE id = $4`,
        [state.oldEquipment, JSON.stringify(state.newEquipment), state.newSlot, state.userId],
      );
    },
  };
}

export function createPgEquipmentSwitchRepository(): EquipmentSwitchRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
