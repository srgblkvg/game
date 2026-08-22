/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { changeEquipment } from './inventoryEquip';
import { createPgEquipmentChangeRepository } from './inventoryEquipRepository';
import { switchEquipmentSet } from './inventoryEquipSwitch';
import { createPgEquipmentSwitchRepository } from './inventoryEquipSwitchRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;
const noBonuses = { drinkBonuses: { s: 0, a: 0, d: 0, m: 0 }, collectionBonus: 0, guildBonus: 0 };
const sword = (id: string) => ({ id, name: `Меч ${id}`, slot: 'weapon1', rarity_id: 1, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 } });

pgTest('параллельные equip сохраняют оба предмета и синхронизируют активный комплект', async () => {
  const username = `equip_lock_${Date.now()}`;
  let userId: number | null = null;
  try {
    const itemA = sword('A');
    const itemB = sword('B');
    const equipment1 = { helmet: { id: 'untouched', name: 'Старый шлем', slot: 'helmet' } };
    userId = Number((await pool.query(
      `INSERT INTO users (
         username, passwordhash, level, gender, inventory, equipment,
         equipment_1, equipment_2, active_equip_slot,
         bases, basea, based, basem, currenthp, lasthpupdate
       ) VALUES ($1, 'test', 1, 'male', $2, '{}', $3::jsonb, '{}'::jsonb, 2, 5, 5, 5, 5, 30, 0)
       RETURNING id`,
      [username, JSON.stringify([itemA, itemB]), JSON.stringify(equipment1)],
    )).rows[0].id);

    const repository = createPgEquipmentChangeRepository();
    const results = await Promise.allSettled([
      changeEquipment(repository, { userId, slotId: 'weapon1', itemId: 'A', now: 1000, ...noBonuses }),
      changeEquipment(repository, { userId, slotId: 'weapon1', itemId: 'B', now: 1000, ...noBonuses }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1, equipment_2, active_equip_slot FROM users WHERE id = $1',
      [userId],
    )).rows[0];
    const inventory = typeof row.inventory === 'string' ? JSON.parse(row.inventory) : row.inventory;
    const legacy = typeof row.equipment === 'string' ? JSON.parse(row.equipment) : row.equipment;
    const active = row.equipment_2;
    const ownedIds = [...inventory.map((item: any) => item.id), legacy.weapon1.id].sort();
    assert.deepEqual(ownedIds, ['A', 'B']);
    assert.deepEqual(legacy, active);
    assert.deepEqual(row.equipment_1, equipment1);
    assert.equal(Number(row.active_equip_slot), 2);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

pgTest('параллельные equip и switch не теряют предметы между комплектами', async () => {
  const username = `equip_switch_lock_${Date.now()}`;
  let userId: number | null = null;
  try {
    const itemA = sword('A');
    const itemB = sword('B');
    userId = Number((await pool.query(
      `INSERT INTO users (
         username, passwordhash, level, gender, inventory, equipment,
         equipment_1, equipment_2, active_equip_slot,
         bases, basea, based, basem, currenthp, lasthpupdate
       ) VALUES ($1, 'test', 1, 'male', $2, $3, $4::jsonb, $5::jsonb, 1, 5, 5, 5, 5, 30, 0)
       RETURNING id`,
      [
        username,
        JSON.stringify([itemB]),
        JSON.stringify({ weapon1: itemA }),
        JSON.stringify({ weapon1: itemA }),
        JSON.stringify({}),
      ],
    )).rows[0].id);

    await Promise.all([
      changeEquipment(createPgEquipmentChangeRepository(), {
        userId, slotId: 'weapon1', itemId: 'B', now: 1000, ...noBonuses,
      }),
      switchEquipmentSet(createPgEquipmentSwitchRepository(), { userId, slot: 2 }),
    ]);

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1, equipment_2, equipment_3 FROM users WHERE id = $1',
      [userId],
    )).rows[0];
    const parse = (value: any) => typeof value === 'string' ? JSON.parse(value) : value;
    const allItems = [
      ...parse(row.inventory),
      ...Object.values(parse(row.equipment_1)),
      ...Object.values(parse(row.equipment_2)),
      ...Object.values(parse(row.equipment_3)),
    ];
    assert.deepEqual(parse(row.equipment), parse(row.equipment_2));
    const counts = allItems.reduce((acc: Record<string, number>, item: any) => {
      if (item?.id === 'A' || item?.id === 'B') acc[item.id] = (acc[item.id] || 0) + 1;
      return acc;
    }, {});
    assert.deepEqual(counts, { A: 1, B: 1 });
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
