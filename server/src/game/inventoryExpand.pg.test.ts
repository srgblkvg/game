/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { expandInventory } from './inventoryExpand';
import { createPgInventoryExpandRepository } from './inventoryExpandRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

pgTest('два параллельных расширения используют последовательные цены', async () => {
  let userId: number | null = null;
  try {
    userId = Number((await pool.query(
      `INSERT INTO users (username, passwordhash, level, gender, inventoryslots, money)
       VALUES ($1, 'test', 1, 'male', 10, 1000)
       RETURNING id`,
      [`expand_lock_${Date.now()}`],
    )).rows[0].id);

    const results = await Promise.all([
      expandInventory(createPgInventoryExpandRepository(), { userId }),
      expandInventory(createPgInventoryExpandRepository(), { userId }),
    ]);
    assert.deepEqual(
      results.sort((left, right) => left.inventorySlots - right.inventorySlots),
      [
        { inventorySlots: 11, moneyAfter: 900 },
        { inventorySlots: 12, moneyAfter: 700 },
      ],
    );

    const row = (await pool.query(
      'SELECT inventoryslots, money FROM users WHERE id=$1', [userId],
    )).rows[0];
    assert.equal(Number(row.inventoryslots), 12);
    assert.equal(Number(row.money), 700);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
