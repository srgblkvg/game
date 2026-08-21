import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';

const enabled = process.env.AUCTION_PG_LOCK_TEST === '1';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function rollback(client: PoolClient): Promise<void> {
  try { await client.query('ROLLBACK'); } catch { /* connection may already be closed */ }
}

test('FOR UPDATE сериализует две операции над одним аукционным лотом', { skip: !enabled }, async () => {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'game_dev',
    user: process.env.PGUSER || 'game',
    password: process.env.PGPASSWORD || 'game123',
    max: 3,
    connectionTimeoutMillis: 5_000,
  });
  const sellerRow = (await pool.query('SELECT id FROM users ORDER BY id LIMIT 1')).rows[0];
  assert.ok(sellerRow, 'В game_dev нужен хотя бы один пользователь');

  const marker = `lock-test-${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  const inserted = await pool.query(
    `INSERT INTO auction_lots
     (sellerid, itemdata, startprice, buyoutprice, duration, endsat, createdat)
     VALUES ($1, $2, 1, 2, 1, $3, $4) RETURNING id`,
    [sellerRow.id, JSON.stringify({ id: marker, name: marker, type: 'craft_item', count: 1 }), now + 3600, now],
  );
  const lotId = Number(inserted.rows[0].id);
  const first = await pool.connect();
  const second = await pool.connect();

  try {
    await first.query('BEGIN');
    await second.query('BEGIN');
    await first.query('SELECT id FROM auction_lots WHERE id = $1 FOR UPDATE', [lotId]);

    let secondAcquired = false;
    const competingLock = second
      .query('SELECT id FROM auction_lots WHERE id = $1 FOR UPDATE', [lotId])
      .then(result => { secondAcquired = true; return result; });

    await wait(150);
    assert.equal(secondAcquired, false, 'Вторая операция не должна пройти, пока первая держит блокировку');

    await first.query('ROLLBACK');
    const result = await competingLock;
    assert.equal(Number(result.rows[0]?.id), lotId);
  } finally {
    await rollback(first);
    await rollback(second);
    first.release();
    second.release();
    await pool.query('DELETE FROM auction_lots WHERE id = $1', [lotId]);
    await pool.end();
  }
});
