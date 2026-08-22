/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { payDungeonLoot } from './dungeonPayout';
import { createPgDungeonPayoutRepository } from './dungeonPayoutRepository';
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

async function createFixture(label: string): Promise<number> {
  const sword = {
    id: 'equip-source', name: 'Тестовый меч', type: 'equipment', slot: 'weapon1', rarity_id: 1,
    bonuses: { s: 1, a: 0, d: 0, m: 0 },
    extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
  };
  const userId = Number((await pool.query(
    `INSERT INTO users (
       username, passwordhash, level, gender, inventory, equipment,
       equipment_1, active_equip_slot, money,
       bases, basea, based, basem, currenthp, lasthpupdate
     ) VALUES ($1, 'test', 1, 'male', $2, '{}', '{}'::jsonb, 1, 100,
               5, 5, 5, 5, 30, 0)
     RETURNING id`,
    [`dungeon_payout_${label}_${Date.now()}`, JSON.stringify([sword])],
  )).rows[0].id);
  await pool.query(
    `INSERT INTO dungeon_runs (
       userid, currentfloor, checkpointfloor, enemydata, playerhp, playermaxhp,
       startedat, maxfloor, maxreward
     ) VALUES ($1, 5, 0, '[]', 30, 30, 0, 0, 0)`,
    [userId],
  );
  return userId;
}

async function cleanup(userId: number | null) {
  if (userId === null) return;
  await pool.query('DELETE FROM skill_pages WHERE userid=$1', [userId]);
  await pool.query('DELETE FROM dungeon_runs WHERE userid=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

pgTest('параллельные dungeon payout и equip сохраняют всю награду', async () => {
  let userId: number | null = null;
  try {
    userId = await createFixture('race');
    await Promise.all([
      payDungeonLoot(createPgDungeonPayoutRepository(), {
        userId,
        loot: {
          silver: 50,
          items: [
            { id: 'resource', type: 'craft_item', count: 2 },
            { id: 'loot-equipment', slot: 'helmet', rarity_id: 1 },
          ],
          pages: [{ skillId: 2 }],
        },
        currentFloor: 7,
        startedAt: 1234,
      }),
      changeEquipment(createPgEquipmentChangeRepository(), {
        userId, slotId: 'weapon1', itemId: 'equip-source', now: 1000, ...noBonuses,
      }),
    ]);

    const row = (await pool.query(
      'SELECT inventory, equipment, equipment_1, money FROM users WHERE id=$1', [userId],
    )).rows[0];
    const inventory = parse(row.inventory);
    const equipment = parse(row.equipment);
    assert.deepEqual(equipment, row.equipment_1);
    assert.equal(equipment.weapon1?.id, 'equip-source');
    assert.equal(inventory.filter((item: any) => item.id === 'equip-source').length, 0);
    assert.equal(inventory.filter((item: any) => item.id === 'loot-equipment').length, 1);
    assert.equal(inventory.find((item: any) => item.id === 'resource')?.count, 2);
    assert.equal(Number(row.money), 150);

    const page = (await pool.query(
      'SELECT count FROM skill_pages WHERE userid=$1 AND skillid=2', [userId],
    )).rows[0];
    assert.equal(Number(page.count), 1);
    const run = (await pool.query(
      'SELECT startedat, maxfloor, maxreward FROM dungeon_runs WHERE userid=$1', [userId],
    )).rows[0];
    assert.deepEqual(
      { startedAt: Number(run.startedat), maxFloor: Number(run.maxfloor), maxReward: Number(run.maxreward) },
      { startedAt: 1234, maxFloor: 7, maxReward: 50 },
    );
  } finally {
    await cleanup(userId);
  }
});

pgTest('ошибка страницы откатывает silver и inventory payout', async () => {
  let userId: number | null = null;
  try {
    userId = await createFixture('rollback');
    await assert.rejects(payDungeonLoot(createPgDungeonPayoutRepository(), {
      userId,
      loot: {
        silver: 50,
        items: [{ id: 'must-rollback', type: 'craft_item', count: 1 }],
        pages: [{ skillId: null as any }],
      },
      currentFloor: 9,
      startedAt: 2222,
    }));

    const row = (await pool.query('SELECT inventory, money FROM users WHERE id=$1', [userId])).rows[0];
    const inventory = parse(row.inventory);
    assert.equal(Number(row.money), 100);
    assert.equal(inventory.some((item: any) => item.id === 'must-rollback'), false);
    const run = (await pool.query(
      'SELECT startedat, maxfloor, maxreward FROM dungeon_runs WHERE userid=$1', [userId],
    )).rows[0];
    assert.deepEqual(
      { startedAt: Number(run.startedat), maxFloor: Number(run.maxfloor), maxReward: Number(run.maxreward) },
      { startedAt: 0, maxFloor: 0, maxReward: 0 },
    );
  } finally {
    await cleanup(userId);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
