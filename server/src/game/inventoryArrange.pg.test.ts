/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { reorderInventory, toggleInventoryLock } from './inventoryArrange';
import { createPgInventoryArrangeRepository } from './inventoryArrangeRepository';
import { salvageInventory } from './inventorySalvage';
import { createPgInventorySalvageRepository } from './inventorySalvageRepository';
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

async function createUser(label: string, inventory: any[]): Promise<number> {
  return Number((await pool.query(
    `INSERT INTO users (
       username, passwordhash, level, gender, inventory, equipment,
       equipment_1, active_equip_slot,
       bases, basea, based, basem, currenthp, lasthpupdate
     ) VALUES ($1, 'test', 1, 'male', $2, '{}', '{}'::jsonb, 1,
               5, 5, 5, 5, 30, 0)
     RETURNING id`,
    [`arrange_${label}_${Date.now()}_${Math.random()}`, JSON.stringify(inventory)],
  )).rows[0].id);
}

pgTest('два параллельных toggle сериализуются без lost update', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('toggle', [{ id: 'lock-item', type: 'equipment', locked: false }]);
    const results = await Promise.all([
      toggleInventoryLock(createPgInventoryArrangeRepository(), { userId, itemId: 'lock-item' }),
      toggleInventoryLock(createPgInventoryArrangeRepository(), { userId, itemId: 'lock-item' }),
    ]);
    assert.deepEqual(results.map(result => result.locked).sort(), [false, true]);
    const inventory = parse((await pool.query('SELECT inventory FROM users WHERE id=$1', [userId])).rows[0].inventory);
    assert.equal(inventory[0].locked, false);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

pgTest('параллельные reorder и salvage сохраняют результат разборки', async () => {
  let userId: number | null = null;
  try {
    const material = (await pool.query(
      'SELECT id, rarity_id FROM craft_items ORDER BY rarity_id, id LIMIT 1',
    )).rows[0];
    assert.ok(material);
    const salvageItem = { id: 'salvage-me', type: 'equipment', rarity_id: Number(material.rarity_id) };
    const keepItem = { id: 'keep-me', type: 'equipment', rarity_id: Number(material.rarity_id) };
    userId = await createUser('salvage', [salvageItem, keepItem]);

    await Promise.all([
      reorderInventory(createPgInventoryArrangeRepository(), {
        userId,
        order: ['keep-me', 'salvage-me'],
      }),
      salvageInventory(createPgInventorySalvageRepository(), {
        userId,
        itemIds: ['salvage-me'],
      }),
    ]);

    const inventory = parse((await pool.query('SELECT inventory FROM users WHERE id=$1', [userId])).rows[0].inventory);
    assert.equal(inventory.filter((item: any) => item.id === 'keep-me').length, 1);
    assert.equal(inventory.filter((item: any) => item.id === 'salvage-me').length, 0);
    assert.equal(inventory
      .filter((item: any) => String(item.id) === String(material.id))
      .reduce((sum: number, item: any) => sum + Number(item.count || 0), 0), 1);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

pgTest('параллельные reorder и equip не возвращают экипированный предмет в inventory', async () => {
  let userId: number | null = null;
  try {
    const item = {
      id: 'equip-me', name: 'Тестовый меч', type: 'equipment', slot: 'weapon1', rarity_id: 1,
      bonuses: { s: 1, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
    };
    const keep = { id: 'keep-me', type: 'equipment', slot: 'helmet', rarity_id: 1 };
    userId = await createUser('equip', [item, keep]);

    await Promise.all([
      reorderInventory(createPgInventoryArrangeRepository(), {
        userId,
        order: ['keep-me', 'equip-me'],
      }),
      changeEquipment(createPgEquipmentChangeRepository(), {
        userId, slotId: 'weapon1', itemId: 'equip-me', now: 1000, ...noBonuses,
      }),
    ]);

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1 FROM users WHERE id=$1', [userId],
    )).rows[0];
    const inventory = parse(row.inventory);
    const legacy = parse(row.equipment);
    assert.deepEqual(legacy, row.equipment_1);
    assert.equal(inventory.filter((candidate: any) => candidate.id === 'equip-me').length, 0);
    assert.equal(legacy.weapon1?.id, 'equip-me');
    assert.equal(inventory.filter((candidate: any) => candidate.id === 'keep-me').length, 1);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
