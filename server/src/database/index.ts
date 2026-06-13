import pgPromise from 'pg-promise';

// --- camelCase результов ---
const camelMap: Record<string, string> = {};
function camelKey(k: string): string {
  if (camelMap[k]) return camelMap[k];
  const cc = k
    .replace(/(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid)$/i, m => m.charAt(0).toUpperCase() + m.slice(1))
    .replace(/taxrate$/i, 'TaxRate').replace(/verified$/i, 'Verified');
  camelMap[k] = cc;
  return cc;
}

function camelRows(rows: any[]): any[] {
  for (const r of rows) for (const k of Object.keys(r)) {
    const cc = camelKey(k);
    if (cc !== k) r[cc] = r[k];
  }
  return rows;
}

// --- ? → $1 ---
function pgSQL(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// --- pg-promise ---
const pgp = pgPromise();
const raw = pgp({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'game',
  user: process.env.PGUSER || 'game',
  password: process.env.PGPASSWORD || 'game123',
  max: 20,
});

// --- Statement (совместимость с better-sqlite3) ---
class Statement {
  private sql: string;
  constructor(sql: string) { this.sql = pgSQL(sql); }
  async get(...p: any[]) { return camelRows(await raw.any(this.sql, p))[0]; }
  async all(...p: any[]) { return camelRows(await raw.any(this.sql, p)); }
  async run(...p: any[]) { const r = await raw.result(this.sql, p); return { changes: r.rowCount }; }
}

// --- Database ---
class Database {
  prepare(sql: string) { return new Statement(sql); }
  async exec(sql: string) { await raw.none(sql); }
  async transaction<T>(fn: (db: any) => Promise<T>): Promise<T> {
    return raw.tx(async (t: any) => {
      const txStmt = (sql: string) => {
        const s = pgSQL(sql);
        return {
          get: async (...p: any[]) => camelRows(await t.any(s, p))[0],
          all: async (...p: any[]) => camelRows(await t.any(s, p)),
          run: async (...p: any[]) => { const r = await t.result(s, p); return { changes: r.rowCount }; },
        };
      };
      const txDb = { prepare: txStmt, exec: (sql: string) => t.none(sql) };
      return fn(txDb);
    });
  }
}

const db = new Database();
console.log('[PG] pg-promise wrapper ready');

export async function initDB() {}
export default db;
