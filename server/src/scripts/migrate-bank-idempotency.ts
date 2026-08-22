import { pool } from '../db';

async function main() {
  await pool.query('ALTER TABLE bank_operations ADD COLUMN IF NOT EXISTS operationid TEXT');
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS bank_operations_user_type_operation_uidx
      ON bank_operations (userid, type, operationid)
      WHERE operationid IS NOT NULL
  `);
  await pool.query('GRANT SELECT, INSERT, UPDATE ON bank_operations TO game');
  console.log('bank idempotency schema ready');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
