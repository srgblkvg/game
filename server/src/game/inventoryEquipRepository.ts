import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { EquipmentChangeRepository, EquipmentChangeTransaction } from './inventoryEquip';

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

function adapter(client: PoolClient): EquipmentChangeTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        `SELECT id, currenthp, bases, basea, based, basem, inventory, equipment,
                equipment_1, equipment_2, equipment_3, active_equip_slot
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      if (!row) return null;
      const activeEquipSlot = Number(row.active_equip_slot || 1);
      const safeSlot = equipmentColumn[activeEquipSlot] ? activeEquipSlot : 1;
      const active = parseEquipment(row[equipmentColumn[safeSlot]!]);
      const legacy = parseEquipment(row.equipment);
      return {
        id: Number(row.id),
        currentHp: Number(row.currenthp),
        baseS: Number(row.bases ?? 5),
        baseA: Number(row.basea ?? 5),
        baseD: Number(row.based ?? 5),
        baseM: Number(row.basem ?? 5),
        inventory: row.inventory,
        equipment: Object.keys(active).length > 0 ? active : legacy,
        activeEquipSlot: safeSlot,
      };
    },
    async saveState(state) {
      const column = equipmentColumn[state.activeEquipSlot];
      if (!column) throw new Error('Некорректный активный комплект');
      await client.query(
        `UPDATE users SET inventory = $1, equipment = $2,
         ${column} = $3::jsonb, currenthp = $4, lasthpupdate = $5
         WHERE id = $6`,
        [
          JSON.stringify(state.inventory),
          JSON.stringify(state.equipment),
          state.equipment,
          state.currentHp,
          state.lastHpUpdate,
          state.userId,
        ],
      );
    },
  };
}

export function createPgEquipmentChangeRepository(): EquipmentChangeRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
