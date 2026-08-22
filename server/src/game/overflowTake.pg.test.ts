/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { takeOverflowItem } from './overflowTake';
import { createPgOverflowTakeRepository } from './overflowTakeRepository';
import { addOverflowItem } from './overflowAdd';
import { createPgOverflowAddRepository } from './overflowAddRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

pgTest('два параллельных take выдают складской предмет ровно один раз', async () => {
  const username = `overflow_lock_${Date.now()}`;
  let userId: number | null = null;
  let overflowId: number | null = null;
  try {
    userId = Number((await pool.query(
      `INSERT INTO users (username, passwordhash, level, gender, inventory, inventoryslots)
       VALUES ($1, 'test', 1, 'male', '[]', 10)
       RETURNING id`,
      [username],
    )).rows[0].id);
    overflowId = Number((await pool.query(
      `INSERT INTO overflow_storage (userid, item)
       VALUES ($1, $2::jsonb)
       RETURNING id`,
      [userId, JSON.stringify({ id: 'pg-lock-item', type: 'material', count: 2 })],
    )).rows[0].id);

    const repository = createPgOverflowTakeRepository();
    const results = await Promise.allSettled([
      takeOverflowItem(repository, { overflowId, userId }),
      takeOverflowItem(repository, { overflowId, userId }),
    ]);

    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const rejected = results.find(result => result.status === 'rejected');
    assert.match(String(rejected && rejected.status === 'rejected' ? rejected.reason?.message : ''), /Предмет не найден/);

    const row = (await pool.query('SELECT inventory FROM users WHERE id = $1', [userId])).rows[0];
    const inventory = typeof row.inventory === 'string' ? JSON.parse(row.inventory) : row.inventory;
    assert.equal(inventory.length, 1);
    assert.equal(inventory[0].id, 'pg-lock-item');
    assert.equal(Number(inventory[0].count), 2);
    assert.equal(Number((await pool.query(
      'SELECT count(*) FROM overflow_storage WHERE id = $1',
      [overflowId],
    )).rows[0].count), 0);
  } finally {
    if (overflowId !== null) await pool.query('DELETE FROM overflow_storage WHERE id = $1', [overflowId]);
    if (userId !== null) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

pgTest('параллельные take и add не теряют складской ресурс', async () => {
  const username = `overflow_add_take_${Date.now()}`;
  let userId: number | null = null;
  try {
    userId = Number((await pool.query(
      `INSERT INTO users (username, passwordhash, level, gender, inventory, inventoryslots)
       VALUES ($1, 'test', 1, 'male', '[]', 10)
       RETURNING id`,
      [username],
    )).rows[0].id);
    const overflowId = Number((await pool.query(
      `INSERT INTO overflow_storage (userid, item)
       VALUES ($1, $2::jsonb)
       RETURNING id`,
      [userId, JSON.stringify({ id: 'race-ore', type: 'material', count: 2 })],
    )).rows[0].id);

    const [takeResult, addResult] = await Promise.allSettled([
      takeOverflowItem(createPgOverflowTakeRepository(), { overflowId, userId }),
      addOverflowItem(createPgOverflowAddRepository(), {
        userId,
        item: { id: 'race-ore', type: 'material', count: 3 },
      }),
    ]);
    assert.equal(takeResult.status, 'fulfilled');
    assert.equal(addResult.status, 'fulfilled');

    const user = (await pool.query('SELECT inventory FROM users WHERE id = $1', [userId])).rows[0];
    const inventory = typeof user.inventory === 'string' ? JSON.parse(user.inventory) : user.inventory;
    const inventoryCount = inventory
      .filter((item: any) => item.id === 'race-ore')
      .reduce((sum: number, item: any) => sum + Number(item.count || 0), 0);
    const overflowRows = (await pool.query(
      `SELECT item FROM overflow_storage
       WHERE userid = $1 AND item->>'id' = 'race-ore'`,
      [userId],
    )).rows;
    const overflowCount = overflowRows.reduce(
      (sum: number, row: any) => sum + Number(row.item?.count || 0),
      0,
    );
    assert.equal(inventoryCount + overflowCount, 5);
  } finally {
    if (userId !== null) {
      await pool.query('DELETE FROM overflow_storage WHERE userid = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
