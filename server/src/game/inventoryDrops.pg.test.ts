/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { grantInventoryDrops } from './inventoryDrops';
import { createPgInventoryDropRepository } from './inventoryDropsRepository';
import { changeEquipment } from './inventoryEquip';
import { createPgEquipmentChangeRepository } from './inventoryEquipRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;
const noBonuses = {
  drinkBonuses: { s: 0, a: 0, d: 0, m: 0 },
  collectionBonus: 0,
  guildBonus: 0,
};
const parse = (value: any) => typeof value === 'string' ? JSON.parse(value) : value;

pgTest('параллельные drops и equip сохраняют всю добычу и владение', async () => {
  let userId: number | null = null;
  try {
    const sword = {
      id: 'equip-source', name: 'Тестовый меч', type: 'equipment', slot: 'weapon1', rarity_id: 1,
      bonuses: { s: 1, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
    };
    userId = Number((await pool.query(
      `INSERT INTO users (
         username, passwordhash, level, gender, inventory, equipment,
         equipment_1, active_equip_slot,
         bases, basea, based, basem, currenthp, lasthpupdate
       ) VALUES ($1, 'test', 1, 'male', $2, '{}', '{}'::jsonb, 1,
                 5, 5, 5, 5, 30, 0)
       RETURNING id`,
      [`drops_equip_${Date.now()}`, JSON.stringify([sword])],
    )).rows[0].id);

    await Promise.all([
      grantInventoryDrops(createPgInventoryDropRepository(), {
        userId,
        drops: [
          { id: 'resource-drop', type: 'craft_item', count: 1 },
          { id: 'resource-drop', type: 'craft_item', count: 1 },
          { id: 'equipment-drop', slot: 'helmet', rarity_id: 1 },
        ],
      }),
      changeEquipment(createPgEquipmentChangeRepository(), {
        userId, slotId: 'weapon1', itemId: 'equip-source', now: 1000, ...noBonuses,
      }),
    ]);

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1 FROM users WHERE id=$1', [userId],
    )).rows[0];
    const inventory = parse(row.inventory);
    const legacy = parse(row.equipment);
    assert.deepEqual(legacy, row.equipment_1);
    assert.equal(legacy.weapon1?.id, 'equip-source');
    assert.equal(inventory.filter((item: any) => item.id === 'equip-source').length, 0);
    assert.equal(inventory.filter((item: any) => item.id === 'equipment-drop').length, 1);
    assert.equal(inventory
      .filter((item: any) => item.id === 'resource-drop')
      .reduce((sum: number, item: any) => sum + Number(item.count || 0), 0), 2);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
