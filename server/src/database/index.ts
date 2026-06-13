import pool from './pg';
import { runSchema } from './schema';
import { runMigrations } from './migrations';
import { runSeed } from './seed';

// PG-совместимая обёртка похожая на better-sqlite3 API
class PgWrapper {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    return pool.query(sql, params);
  }

  // Эмулирует db.prepare(sql).get(params)
  prepareGet(sql: string) {
    return async (...params: any[]): Promise<any | undefined> => {
      const res = await pool.query(sql, params);
      return res.rows[0];
    };
  }

  // Эмулирует db.prepare(sql).all(params)
  prepareAll(sql: string) {
    return async (...params: any[]): Promise<any[]> => {
      const res = await pool.query(sql, params);
      return res.rows;
    };
  }

  // Эмулирует db.prepare(sql).run(params)
  prepareRun(sql: string) {
    return async (...params: any[]): Promise<{ changes: number; lastInsertRowid?: number }> => {
      // Попытка получить RETURNING id для INSERT
      const res = await pool.query(sql, params);
      const lastId = res.rows?.[0]?.id;
      return { changes: res.rowCount ?? 0, lastInsertRowid: lastId ? Number(lastId) : undefined };
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
    return this.client.query(sql, params);
  }

  prepareGet(sql: string) {
    return async (...params: any[]) => {
      const res = await this.client.query(sql, params);
      return res.rows[0];
    };
  }

  prepareAll(sql: string) {
    return async (...params: any[]) => {
      const res = await this.client.query(sql, params);
      return res.rows;
    };
  }

  prepareRun(sql: string) {
    return async (...params: any[]) => {
      const res = await this.client.query(sql, params);
      const lastId = res.rows?.[0]?.id;
      return { changes: res.rowCount ?? 0, lastInsertRowid: lastId ? Number(lastId) : undefined };
    };
  }
}

const db = new PgWrapper();

// Инициализация БД при импорте
export async function initDB() {
  await runSchema(db);
  await runMigrations(db);
  await runSeed(db);
}

export default db;
