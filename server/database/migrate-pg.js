"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// migrate-pg.ts — перенос данных из SQLite в PG
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const pg_1 = require("pg");
const sqlite = new better_sqlite3_1.default('../game.db');
const pg = new pg_1.Pool({ host: 'localhost', database: 'game', user: 'game', password: 'game123' });
async function migrate() {
    // Список таблиц для миграции (в порядке FK зависимостей)
    const tables = [
        'rarities', 'items', 'craft_items',
        'admins', 'users',
        'battles', 'chat_messages',
        'guilds', 'guild_members', 'guild_invites', 'guild_wars', 'guild_treasury_log',
        'tournaments', 'tournament_participants', 'tournament_matches',
        'daily_quests', 'quest_history',
        'job_history', 'login_logs', 'feedback_messages',
        'seasons', 'hall_of_fame',
        'collections', 'collection_sets', 'collection_set_items',
        'craft_recipes', 'craft_recipe_ingredients',
        'shop_items', 'mobs', 'mob_drops', 'floors', 'jobs', 'drinks',
    ];
    for (const table of tables) {
        try {
            const rows = sqlite.prepare(`SELECT * FROM [${table}]`).all();
            if (rows.length === 0) {
                console.log(`SKIP: ${table} (empty)`);
                continue;
            }
            const columns = Object.keys(rows[0]).map(c => c.toLowerCase()).join(', ');
            const placeholders = Object.keys(rows[0]).map((_, i) => `$${i + 1}`).join(', ');
            const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
            for (const row of rows) {
                const vals = Object.keys(rows[0]).map(k => row[k] ?? null);
                try {
                    await pg.query(sql, vals);
                }
                catch (e) {
                    // Skip duplicates
                    if (e.message.includes('duplicate key'))
                        continue;
                    console.log(`ERR ${table}:`, e.message.split('\n')[0].substring(0, 80));
                }
            }
            console.log(`OK: ${table} (${rows.length} rows)`);
        }
        catch (e) {
            console.log(`SKIP: ${table} - ${e.message.split('\n')[0].substring(0, 60)}`);
        }
    }
    await pg.end();
    sqlite.close();
    console.log('Migration done');
}
migrate();
//# sourceMappingURL=migrate-pg.js.map