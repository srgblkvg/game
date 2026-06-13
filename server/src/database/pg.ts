import { Pool, PoolConfig } from 'pg';

const config: PoolConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'game',
  user: process.env.PGUSER || 'game',
  password: process.env.PGPASSWORD || 'game123',
  max: 20,
  idleTimeoutMillis: 30000,
};

const pool = new Pool(config);

// Проверка соединения при старте
pool.query('SELECT 1').then(() => console.log('[PG] Connected')).catch(err => {
  console.error('[PG] Connection failed:', err.message);
  process.exit(1);
});

export default pool;
