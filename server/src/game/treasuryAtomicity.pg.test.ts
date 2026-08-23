import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { changeTreasuryWithClient } from './treasury';

const enabled = process.env.RUN_PG_TESTS === '1' && process.env.PGDATABASE === 'game_dev';
const integration = enabled ? test : test.skip;

integration('treasury balance and log commit or rollback together', async () => {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'game_dev',
    user: process.env.PGUSER || 'game',
    password: process.env.PGPASSWORD || 'game123',
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  const client = await pool.connect();
  try {
    await client.query('CREATE TEMP TABLE castle_treasury (id INTEGER PRIMARY KEY, amount INTEGER NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())');
    await client.query("CREATE TEMP TABLE treasury_log (amount INTEGER NOT NULL, source TEXT NOT NULL CHECK (source <> 'forced_failure'), created_at TIMESTAMPTZ DEFAULT NOW())");
    await client.query('INSERT INTO castle_treasury (id, amount) VALUES (1, 100)');

    await client.query('BEGIN');
    await changeTreasuryWithClient(client, 17, 'add');
    await client.query('COMMIT');
    assert.equal(Number((await client.query('SELECT amount FROM castle_treasury WHERE id = 1')).rows[0].amount), 117);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM treasury_log')).rows[0].count), 1);

    await client.query('BEGIN');
    await changeTreasuryWithClient(client, -17, 'deduct');
    await client.query('COMMIT');
    assert.equal(Number((await client.query('SELECT amount FROM castle_treasury WHERE id = 1')).rows[0].amount), 100);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM treasury_log')).rows[0].count), 2);

    await client.query('BEGIN');
    await assert.rejects(changeTreasuryWithClient(client, 23, 'forced_failure'));
    await client.query('ROLLBACK');
    assert.equal(Number((await client.query('SELECT amount FROM castle_treasury WHERE id = 1')).rows[0].amount), 100);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM treasury_log')).rows[0].count), 2);
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* connection may already be idle */ }
    client.release();
    await pool.end();
  }
});
