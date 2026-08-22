/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { addInventoryItemToCollection } from './collectionAdd';
import { createPgCollectionAddRepository } from './collectionAddRepository';
import { changeEquipment } from './inventoryEquip';
import { createPgEquipmentChangeRepository } from './inventoryEquipRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;
const parse = (value: any) => typeof value === 'string' ? JSON.parse(value) : value;
const noBonuses = {
  drinkBonuses: { s: 0, a: 0, d: 0, m: 0 },
  collectionBonus: 0,
  guildBonus: 0,
};

async function collectionTemplate() {
  const row = (await pool.query(`
    SELECT item_name, slot, rarity_id
    FROM collection_set_items
    WHERE item_name IS NOT NULL AND slot IS NOT NULL AND rarity_id IS NOT NULL
    ORDER BY set_id, item_name LIMIT 1
  `)).rows[0];
  assert.ok(row, 'collection_set_items fixture required');
  return { name: row.item_name, slot: row.slot, rarityId: Number(row.rarity_id) };
}

async function createUser(label: string, inventory: any[]): Promise<number> {
  return Number((await pool.query(
    `INSERT INTO users (
       username, passwordhash, level, gender, inventory, equipment,
       equipment_1, active_equip_slot,
       bases, basea, based, basem, currenthp, lasthpupdate
     ) VALUES ($1, 'test', 1, 'male', $2, '{}', '{}'::jsonb, 1,
               5, 5, 5, 5, 30, 0)
     RETURNING id`,
    [`collection_add_${label}_${Date.now()}_${Math.random()}`, JSON.stringify(inventory)],
  )).rows[0].id);
}

async function cleanup(userId: number | null) {
  if (userId === null) return;
  await pool.query('DELETE FROM collections WHERE userid=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

pgTest('два параллельных добавления не дублируют коллекцию и не теряют inventory', async () => {
  let userId: number | null = null;
  try {
    const template = await collectionTemplate();
    const item = {
      id: 'collect-once', name: template.name, slot: template.slot,
      rarity_id: template.rarityId, upgradeLevel: 0,
    };
    userId = await createUser('double', [item, { id: 'keep', name: 'Keep', slot: 'helmet' }]);
    const call = () => addInventoryItemToCollection(createPgCollectionAddRepository(), {
      userId: userId!, itemName: item.name, slot: item.slot,
      itemId: item.id, targetLevel: 0,
    });
    const settled = await Promise.allSettled([call(), call()]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(settled.filter(result => result.status === 'rejected').length, 1);

    const inventory = parse((await pool.query('SELECT inventory FROM users WHERE id=$1', [userId])).rows[0].inventory);
    assert.equal(inventory.some((candidate: any) => candidate.id === item.id), false);
    assert.equal(inventory.filter((candidate: any) => candidate.id === 'keep').length, 1);
    const count = Number((await pool.query(
      `SELECT COUNT(*)::int AS count FROM collections
       WHERE userid=$1 AND itemname=$2 AND slot=$3 AND rarity_id=$4 AND upgradelevel < 7`,
      [userId, item.name, item.slot, item.rarity_id],
    )).rows[0].count);
    assert.equal(count, 1);
  } finally {
    await cleanup(userId);
  }
});

pgTest('параллельные collection add и equip сохраняют владение обоими предметами', async () => {
  let userId: number | null = null;
  try {
    const template = await collectionTemplate();
    const collectionItem = {
      id: 'collect-me', name: template.name, slot: template.slot,
      rarity_id: template.rarityId, upgradeLevel: 0,
    };
    const sword = {
      id: 'equip-me', name: 'Тестовый меч', type: 'equipment', slot: 'weapon1', rarity_id: 1,
      bonuses: { s: 1, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
    };
    userId = await createUser('equip', [collectionItem, sword]);

    await Promise.all([
      addInventoryItemToCollection(createPgCollectionAddRepository(), {
        userId, itemName: collectionItem.name, slot: collectionItem.slot,
        itemId: collectionItem.id, targetLevel: 0,
      }),
      changeEquipment(createPgEquipmentChangeRepository(), {
        userId, slotId: 'weapon1', itemId: sword.id, now: 1000, ...noBonuses,
      }),
    ]);

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1 FROM users WHERE id=$1', [userId],
    )).rows[0];
    const inventory = parse(row.inventory);
    const equipment = parse(row.equipment);
    assert.deepEqual(equipment, row.equipment_1);
    assert.equal(equipment.weapon1?.id, sword.id);
    assert.equal(inventory.some((item: any) => item.id === sword.id), false);
    assert.equal(inventory.some((item: any) => item.id === collectionItem.id), false);
    const count = Number((await pool.query(
      'SELECT COUNT(*)::int AS count FROM collections WHERE userid=$1', [userId],
    )).rows[0].count);
    assert.equal(count, 1);
  } finally {
    await cleanup(userId);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
