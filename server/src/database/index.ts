import pgPromise from 'pg-promise';

// CamelCase converter for result rows
function camelKeys(row: any): any {
  const out: any = { ...row };
  for (const key of Object.keys(row)) {
    const cc = key.replace(/(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid)$/i, m => m.charAt(0).toUpperCase() + m.slice(1)).replace(/taxrate$/i, 'TaxRate').replace(/verified$/i, 'Verified');
    if (cc !== key) out[cc] = row[key];
  }
  return out;
}

const pgp = pgPromise({
  receive(data) {
    if (Array.isArray(data)) data.forEach(row => camelKeys(row));
  },
});

const db = pgp({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'game',
  user: process.env.PGUSER || 'game',
  password: process.env.PGPASSWORD || 'game123',
  max: 20,
});

console.log('[PG] pg-promise connected');

export async function initDB() {}
export default db;
