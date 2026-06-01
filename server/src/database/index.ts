import Database, { Database as DatabaseType } from 'better-sqlite3';
import { runSchema } from './schema';
import { runMigrations } from './migrations';
import { runSeed } from './seed';

const db: DatabaseType = new Database('game.db');

runSchema(db);
runMigrations(db);
runSeed(db);

export default db;
