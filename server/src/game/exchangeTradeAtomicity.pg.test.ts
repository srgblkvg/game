/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { buyGoldWithClient } from './exchangeTrade';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

pgTest('exchange buy rolls back user, treasury, reserve and history together', async () => {
  const client = await pool.connect();
  const userId = Number(process.env.EXCHANGE_TEST_USER_ID || 0);
  assert.ok(userId > 0, 'EXCHANGE_TEST_USER_ID is required');
  try {
    await client.query('BEGIN');
    const before = await client.query(`
      SELECT u.money, u.gold, c.amount AS silver, e.amount AS gold,
        (SELECT COUNT(*) FROM exchange_history) AS history
      FROM users u CROSS JOIN castle_treasury c CROSS JOIN exchange_gold e
      WHERE u.id = $1 AND c.id = 1 AND e.id = 1`, [userId]);
    assert.equal(before.rowCount, 1);
    await client.query('SAVEPOINT before_trade');
    const result = await buyGoldWithClient(client, userId, 1);
    assert.equal(result.ok, true);
    await client.query('ROLLBACK TO SAVEPOINT before_trade');
    const after = await client.query(`
      SELECT u.money, u.gold, c.amount AS silver, e.amount AS gold,
        (SELECT COUNT(*) FROM exchange_history) AS history
      FROM users u CROSS JOIN castle_treasury c CROSS JOIN exchange_gold e
      WHERE u.id = $1 AND c.id = 1 AND e.id = 1`, [userId]);
    assert.deepEqual(after.rows[0], before.rows[0]);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});

test.after(async () => { if (shouldRun) await pool.end(); });
