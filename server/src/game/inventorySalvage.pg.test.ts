/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { changeEquipment } from './inventoryEquip';
import { createPgEquipmentChangeRepository } from './inventoryEquipRepository';
import { salvageInventory } from './inventorySalvage';
import { createPgInventorySalvageRepository } from './inventorySalvageRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;
const noBonuses = {
  drinkBonuses: { s: 0, a: 0, d: 0, m: 0 },
  collectionBonus: 0,
  guildBonus: 0,
};

pgTest('параллельные salvage и equip не теряют и не дублируют предмет', async () => {
  const username = `salvage_equip_lock_${Date.now()}`;
  let userId: number | null = null;
  try {
    const material = (await pool.query(
      `SELECT c.id, c.rarity_id
       FROM craft_items c
       JOIN rarities r ON r.id = c.rarity_id
       ORDER BY c.rarity_id, c.id
       LIMIT 1`,
    )).rows[0];
    assert.ok(material, 'dev database must contain a salvage material');

    const item = {
      id: 'salvage-race-item',
      name: 'Тестовый меч',
      type: 'equipment',
      slot: 'weapon1',
      rarity_id: Number(material.rarity_id),
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
      [username, JSON.stringify([item])],
    )).rows[0].id);

    const results = await Promise.allSettled([
      salvageInventory(createPgInventorySalvageRepository(), {
        userId,
        itemIds: [item.id],
      }),
      changeEquipment(createPgEquipmentChangeRepository(), {
        userId,
        slotId: 'weapon1',
        itemId: item.id,
        now: 1000,
        ...noBonuses,
      }),
    ]);
    assert.ok(results.some(result => result.status === 'fulfilled'));

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1 FROM users WHERE id = $1',
      [userId],
    )).rows[0];
    const inventory = typeof row.inventory === 'string' ? JSON.parse(row.inventory) : row.inventory;
    const legacy = typeof row.equipment === 'string' ? JSON.parse(row.equipment) : row.equipment;
    const active = row.equipment_1;
    assert.deepEqual(legacy, active);

    const itemCopies = inventory.filter((candidate: any) => candidate.id === item.id).length
      + (legacy.weapon1?.id === item.id ? 1 : 0);
    const materialCount = inventory
      .filter((candidate: any) => String(candidate.id) === String(material.id))
      .reduce((sum: number, candidate: any) => sum + Number(candidate.count || 0), 0);

    assert.equal(itemCopies + materialCount, 1);
    assert.ok(
      (itemCopies === 1 && materialCount === 0)
      || (itemCopies === 0 && materialCount === 1),
    );
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
