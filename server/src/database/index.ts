import pool from './pg';

// Конвертирует ? в $1, $2, ...
async function pgParams(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Нижний регистр для имён колонок в SQL (PG lowercases unquoted identifiers)
// passwordHash → passwordhash, currentHp → currenthp
// Не трогаем строковые литералы (в кавычках)
async function lowercaseSQL(sql: string): string {
  // Разбиваем на части: строки в кавычках и всё остальное
  // Кавычки: '...' и "..." (PG dollar-quoting не используется)
  const parts: string[] = [];
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'") {
      const end = sql.indexOf("'", i + 1);
      if (end === -1) { parts.push(sql.slice(i).toLowerCase()); i = sql.length; }
      else { parts.push(sql.slice(i, end + 1)); i = end + 1; }
    } else if (sql[i] === '"') {
      const end = sql.indexOf('"', i + 1);
      if (end === -1) { parts.push(sql.slice(i).toLowerCase()); i = sql.length; }
      else { parts.push(sql.slice(i, end + 1)); i = end + 1; }
    } else {
      const nextQuote = Math.min(
        sql.indexOf("'", i) === -1 ? Infinity : sql.indexOf("'", i),
        sql.indexOf('"', i) === -1 ? Infinity : sql.indexOf('"', i)
      );
      const end = nextQuote === Infinity ? sql.length : nextQuote;
      parts.push(sql.slice(i, end).toLowerCase());
      i = end;
    }
  }
  return parts.join('');
}

// CamelCase ключи для результатов
async function camelRows(rows: any[]): any[] {
  return rows.map(row => {
    const out: any = { ...row };
    for (const key of Object.keys(row)) {
      if (key.match(/hash$/)) out[key.replace(/hash$/, 'Hash')] = row[key];
      if (key.match(/hp$/)) out[key.replace(/hp$/, 'Hp')] = row[key];
      if (key.match(/id$/)) out[key.replace(/id$/, 'Id')] = row[key];
      if (key.match(/until$/)) out[key.replace(/until$/, 'Until')] = row[key];
      if (key.match(/at$/)) out[key.replace(/at$/, 'At')] = row[key];
      if (key.match(/time$/)) out[key.replace(/time$/, 'Time')] = row[key];
      if (key.match(/name$/)) out[key.replace(/name$/, 'Name')] = row[key];
      if (key.match(/type$/)) out[key.replace(/type$/, 'Type')] = row[key];
      if (key.match(/count$/)) out[key.replace(/count$/, 'Count')] = row[key];
      if (key.match(/level$/)) out[key.replace(/level$/, 'Level')] = row[key];
      if (key.match(/slots$/)) out[key.replace(/slots$/, 'Slots')] = row[key];
      if (key.match(/bonus$/)) out[key.replace(/bonus$/, 'Bonus')] = row[key];
      if (key.match(/logins$/)) out[key.replace(/logins$/, 'Logins')] = row[key];
      if (key.match(/amount$/)) out[key.replace(/amount$/, 'Amount')] = row[key];
      if (key.match(/price$/)) out[key.replace(/price$/, 'Price')] = row[key];
      if (key.match(/pool$/)) out[key.replace(/pool$/, 'Pool')] = row[key];
      if (key.match(/fee$/)) out[key.replace(/fee$/, 'Fee')] = row[key];
      if (key.match(/cost$/)) out[key.replace(/cost$/, 'Cost')] = row[key];
      if (key.match(/won$/)) out[key.replace(/won$/, 'Won')] = row[key];
      if (key.match(/lost$/)) out[key.replace(/lost$/, 'Lost')] = row[key];
      if (key.match(/gained$/)) out[key.replace(/gained$/, 'Gained')] = row[key];
      if (key.match(/rowid$/)) out[key.replace(/rowid$/, 'Rowid')] = row[key];
      if (key.match(/taxrate$/)) out['taxRate'] = row[key];
      if (key.match(/verified$/)) out[key.replace(/verified$/, 'Verified')] = row[key];
    }
    return out;
  });
}

// PG wrapper с авто-lowercase SQL
class DB {
  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    return pool.query(lowercaseSQL(pgParams(sql)), params);
  }

  prepare(sql: string) {
    const q = lowercaseSQL(pgParams(sql));
    console.log('[DB] SQL len:', q?.length, 'preview:', q?.substring(0, 80));
    return {
      get: async (...p: any[]) => { const r = await pool.query(q, p); return camelRows(r.rows)[0]; },
      all: async (...p: any[]) => { const r = await pool.query(q, p); return camelRows(r.rows); },
      run: async (...p: any[]) => { const r = await pool.query(q, p); const id = r.rows?.[0]?.id; return { changes: r.rowCount ?? 0, lastInsertRowid: id ? Number(id) : undefined }; },
    };
  }

  async exec(sql: string) {
    await pool.query(sql);
  }

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        prepare: (sql: string) => {
          const q = lowercaseSQL(pgParams(sql));
          return {
            get: async (...p: any[]) => { const r = await client.query(q, p); return camelRows(r.rows)[0]; },
            all: async (...p: any[]) => { const r = await client.query(q, p); return camelRows(r.rows); },
            run: async (...p: any[]) => { const r = await client.query(q, p); const id = r.rows?.[0]?.id; return { changes: r.rowCount ?? 0, lastInsertRowid: id ? Number(id) : undefined }; },
          };
        },
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

const db = new DB();

export async function initDB() {
  console.log('[PG] Ready (tables pre-created)');
}

export default db;
