"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const config = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'game',
    user: process.env.PGUSER || 'game',
    password: process.env.PGPASSWORD || 'game123',
    max: 20,
    idleTimeoutMillis: 30000,
};
const pool = new pg_1.Pool(config);
pool.query('SELECT 1').then(() => console.log('[PG] Connected')).catch(err => {
    console.error('[PG] Connection failed:', err.message);
    process.exit(1);
});
exports.default = pool;
//# sourceMappingURL=pg.js.map