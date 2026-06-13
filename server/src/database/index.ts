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
  // Auto-convert ? placeholders to $1, $2...
  query(e) {
    // pg-promise automatically handles $1, $2 — we format ? → $1 here
  },
});

const cn = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'game',
  user: process.env.PGUSER || 'game',
  password: process.env.PGPASSWORD || 'game123',
  max: 20,
};

const db = pgp(cn);

// Monkey-patch: auto-convert ? to $N in all queries
const origQuery = db.query.bind(db);
const origOneOrNone = db.oneOrNone.bind(db);
const origManyOrNone = db.manyOrNone.bind(db);
const origNone = db.none.bind(db);

function convertQuery(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

(db as any).query = (sql: string, params?: any[]) => origQuery(convertQuery(sql), params);
(db as any).oneOrNone = (sql: string, params?: any[]) => origOneOrNone(convertQuery(sql), params);
(db as any).manyOrNone = (sql: string, params?: any[]) => origManyOrNone(convertQuery(sql), params);
(db as any).none = (sql: string, params?: any[]) => origNone(convertQuery(sql), params);

// tx helper with ? conversion
const origTx = db.tx.bind(db);
(db as any).tx = (cb: any) => {
  const wrappedTx = {
    oneOrNone: (sql: string, params?: any[]) => ({} as any),
    manyOrNone: (sql: string, params?: any[]) => ({} as any),
    none: (sql: string, params?: any[]) => ({} as any),
  };
  return origTx(async (t: any) => {
    wrappedTx.oneOrNone = (sql: string, params?: any[]) => t.oneOrNone(convertQuery(sql), params);
    wrappedTx.manyOrNone = (sql: string, params?: any[]) => t.manyOrNone(convertQuery(sql), params);
    wrappedTx.none = (sql: string, params?: any[]) => t.none(convertQuery(sql), params);
    return cb(wrappedTx);
  });
};

console.log('[PG] pg-promise connected');

export async function initDB() {}
export default db;
