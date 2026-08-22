import { pool } from '../db/index';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS payment_deliveries (
      id BIGSERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      provider_user_id BIGINT NOT NULL,
      character_id INTEGER,
      item TEXT NOT NULL,
      status TEXT NOT NULL,
      processed_at BIGINT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (provider, external_id)
    )`);
    const conflict = (await client.query(`SELECT order_id FROM vk_payments
      WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
      HAVING COUNT(DISTINCT user_id) > 1 OR COUNT(DISTINCT item) > 1
        OR COUNT(DISTINCT NULLIF(character_id, 0)) > 1
        OR BOOL_OR(character_id IS NULL OR character_id <= 0) LIMIT 1`)).rows[0];
    if (conflict) throw new Error('conflicting historical VK payment identities: ' + conflict.order_id);
    await client.query(`INSERT INTO payment_deliveries
      (provider, external_id, provider_user_id, character_id, item, status, processed_at)
      SELECT 'vk', order_id, MAX(user_id), NULLIF(MAX(character_id), 0), MAX(item), 'succeeded', MAX(processed_at)
      FROM vk_payments WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
      ON CONFLICT (provider, external_id) DO NOTHING`);
    await client.query('GRANT ALL ON payment_deliveries TO game');
    await client.query('GRANT ALL ON SEQUENCE payment_deliveries_id_seq TO game');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().then(() => pool.end()).catch(async error => {
  console.error(error instanceof Error ? error.message : error);
  await pool.end();
  process.exitCode = 1;
});
