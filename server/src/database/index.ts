import pgPromise from 'pg-promise';

function toCamelCase(str: string): string {
  // passwordhash → passwordHash, currenthp → currentHp, etc.
  return str.replace(/(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid|verified)$/i, (m) => {
    return m.charAt(0).toUpperCase() + m.slice(1);
  }).replace(/taxrate$/i, 'TaxRate');
}

function camelCaseRows(data: any[]): any[] {
  return data.map(row => {
    const out: any = { ...row };
    for (const key of Object.keys(row)) {
      const cc = toCamelCase(key);
      if (cc !== key) out[cc] = row[key];
    }
    return out;
  });
}

const pgp = pgPromise({
  receive(data, result, e) {
    // Автоматически добавляем camelCase ключи ко всем результатам
    if (Array.isArray(data)) {
      camelCaseRows(data);
    }
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

console.log('[PG] Connected via pg-promise');

export async function initDB() {
  console.log('[PG] Ready');
}

export default db;
