import pool from './pg';
import { runSchema } from './schema';
import { runMigrations } from './migrations';
import { runSeed } from './seed';

// Конвертирует ? в $1, $2, ... для совместимости с SQLite-синтаксисом
function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Конвертирует ключи строк из lowercase в camelCase для совместимости с legacy кодом
// PG возвращает колонки в lowercase, код ожидает camelCase (как в SQLite)
// Добавляет ОБА варианта ключей в каждую строку
function camelCaseRows(rows: any[]): any[] {
  return rows.map(row => {
    const out: any = { ...row }; // сохраняем оригинальные lowercase ключи
    for (const key of Object.keys(row)) {
      // Конвертируем snake_case или flat lowercase → camelCase
      // currentHp → currenthp → добавляем currentHp
      // passwordHash → passwordhash → добавляем passwordHash
      // baseS → bases → добавляем baseS  
      // Проходим по известным camelCase-суффиксам и добавляем их
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
    }
    return out;
  });
}

// PG-совместимая обёртка похожая на better-sqlite3 API
class PgWrapper {
  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    return pool.query(convertPlaceholders(sql), params);
  }

  // Эмулирует db.prepare(sql).get(params)
  prepareGet(sql: string) {
    const converted = convertPlaceholders(sql);
    return async (...params: any[]): Promise<any | undefined> => {
      const res = await pool.query(converted, params);
      const rows = camelCaseRows(res.rows);
      return rows[0];
    };
  }

  // Эмулирует db.prepare(sql).all(params)
  prepareAll(sql: string) {
    const converted = convertPlaceholders(sql);
    return async (...params: any[]): Promise<any[]> => {
      const res = await pool.query(converted, params);
      return camelCaseRows(res.rows);
    };
  }

  // Эмулирует db.prepare(sql).run(params)
  prepareRun(sql: string) {
    const converted = convertPlaceholders(sql);
    return async (...params: any[]): Promise<{ changes: number; lastInsertRowid?: number }> => {
      const res = await pool.query(converted, params);
      const lastId = res.rows?.[0]?.id;
      return { changes: res.rowCount ?? 0, lastInsertRowid: lastId ? Number(lastId) : undefined };
    };
  }

  // Совместимость со старым API: db.prepare(sql).get/all/run()
  prepare(sql: string) {
    const converted = convertPlaceholders(sql);
    return {
      get: async (...params: any[]) => {
        const res = await pool.query(converted, params);
        return camelCaseRows(res.rows)[0];
      },
      all: async (...params: any[]) => {
        const res = await pool.query(converted, params);
        return camelCaseRows(res.rows);
      },
      run: async (...params: any[]) => {
        const res = await pool.query(converted, params);
        const lastId = res.rows?.[0]?.id;
        return { changes: res.rowCount ?? 0, lastInsertRowid: lastId ? Number(lastId) : undefined };
      },
    };
  }

  // Прямой exec (для создания таблиц и т.д.)
  async exec(sql: string) {
    await pool.query(sql);
  }

  // Транзакция
  async transaction<T>(fn: (db: PgTransaction) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = new PgTransaction(client);
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

class PgTransaction {
  constructor(private client: any) {}

  async query(sql: string, params?: any[]) {
    return this.client.query(convertPlaceholders(sql), params);
  }

  prepareGet(sql: string) {
    const converted = convertPlaceholders(sql);
    return async (...params: any[]) => {
      const res = await this.client.query(converted, params);
      return res.rows[0];
    };
  }

  prepareAll(sql: string) {
    const converted = convertPlaceholders(sql);
    return async (...params: any[]) => {
      const res = await this.client.query(converted, params);
      return res.rows;
    };
  }

  prepareRun(sql: string) {
    const converted = convertPlaceholders(sql);
    return async (...params: any[]) => {
      const res = await this.client.query(converted, params);
      const lastId = res.rows?.[0]?.id;
      return { changes: res.rowCount ?? 0, lastInsertRowid: lastId ? Number(lastId) : undefined };
    };
  }

  prepare(sql: string) {
    const converted = convertPlaceholders(sql);
    return {
      get: async (...params: any[]) => { const res = await this.client.query(converted, params); return res.rows[0]; },
      all: async (...params: any[]) => { const res = await this.client.query(converted, params); return res.rows; },
      run: async (...params: any[]) => { const res = await this.client.query(converted, params); const lastId = res.rows?.[0]?.id; return { changes: res.rowCount ?? 0, lastInsertRowid: lastId ? Number(lastId) : undefined }; },
    };
  }
}

const db = new PgWrapper();

// Инициализация БД при импорте
export async function initDB() {
  await runSchema();
  // Миграции и сиды пропущены — PG схема уже содержит все поля, данные сидируются отдельно
}

export default db;
