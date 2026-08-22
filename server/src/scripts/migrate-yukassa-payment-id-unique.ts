import { pool } from '../db/index';

async function main() {
  // Production read-only audit found zero duplicate payment_id groups before this migration was authored.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx
      ON yukassa_payments (payment_id)
  `);
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exitCode = 1;
  });
