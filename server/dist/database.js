"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const db = new better_sqlite3_1.default('game.db');
// ---------- Таблица пользователей ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    money INTEGER DEFAULT 0,
    totalBattles INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    inventory TEXT DEFAULT '[]',
    equipment TEXT DEFAULT '{}',
    currentHp INTEGER DEFAULT 100,
    lastHpUpdate INTEGER DEFAULT (strftime('%s','now')),
    lastAttackTime INTEGER DEFAULT 0,
    protectionUntil INTEGER DEFAULT 0,
    inventorySlots INTEGER DEFAULT 10,
    activeJob TEXT DEFAULT NULL,
    chatBannedUntil INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// ---------- Таблица администраторов ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// ---------- Миграции (добавление новых колонок, если их ещё нет) ----------
const migrations = [
    'ALTER TABLE users ADD COLUMN totalBattles INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN wins INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN currentHp INTEGER DEFAULT 100',
    'ALTER TABLE users ADD COLUMN money INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN lastHpUpdate INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN lastAttackTime INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN protectionUntil INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN inventorySlots INTEGER DEFAULT 10',
    'ALTER TABLE users ADD COLUMN activeJob TEXT DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN chatBannedUntil INTEGER DEFAULT 0',
    'ALTER TABLE chat_messages ADD COLUMN item_data TEXT DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN openPrivateTabs TEXT DEFAULT \'[]\'',
    'ALTER TABLE items ADD COLUMN upgradeLevel INTEGER DEFAULT 0',
    'ALTER TABLE items ADD COLUMN image TEXT DEFAULT NULL',
    'ALTER TABLE craft_items ADD COLUMN type TEXT DEFAULT \'craft\'',
    'ALTER TABLE craft_recipes ADD COLUMN result_type TEXT DEFAULT \'\'',
    'ALTER TABLE craft_recipes ADD COLUMN result_id INTEGER DEFAULT 0',
    'ALTER TABLE craft_recipes ADD COLUMN success_chance INTEGER DEFAULT 100',
    'ALTER TABLE craft_recipes ADD COLUMN category_id INTEGER DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN gender TEXT DEFAULT \'male\'',
];
for (const sql of migrations) {
    try {
        db.exec(sql);
    }
    catch (e) { /* колонка уже существует */ }
}
// ---------- Таблица боёв ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attackerId INTEGER NOT NULL,
    defenderId INTEGER NOT NULL,
    winnerId INTEGER NOT NULL,
    log TEXT DEFAULT '[]',
    steps TEXT DEFAULT '[]',
    attackerHpAfter INTEGER NOT NULL,
    defenderHpAfter INTEGER NOT NULL,
    expGained INTEGER DEFAULT 0,
    moneyGained INTEGER DEFAULT 0,
    moneyStolen INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attackerId) REFERENCES users(id),
    FOREIGN KEY (defenderId) REFERENCES users(id)
  )
`);
// ---------- Таблица работ ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    duration INTEGER NOT NULL,
    rewardMin INTEGER NOT NULL DEFAULT 0,
    rewardMax INTEGER NOT NULL DEFAULT 0
  )
`);
// ---------- Таблица истории работ ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS job_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    jobId INTEGER NOT NULL,
    jobName TEXT NOT NULL,
    duration INTEGER NOT NULL,
    reward INTEGER NOT NULL,
    startedAt DATETIME NOT NULL,
    finishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);
// ---------- Таблица предметов ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slot TEXT NOT NULL,
    rarity INTEGER NOT NULL,
    bonuses TEXT DEFAULT '{}',
    extra TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// ---------- Таблица сообщений чата ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER NOT NULL,
    targetId INTEGER,
    content TEXT NOT NULL,
    item_data TEXT DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senderId) REFERENCES users(id)
  )
`);
// ---------- Индексы для производительности ----------
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_wins ON users(wins DESC);
  CREATE INDEX IF NOT EXISTS idx_users_chat_banned ON users(chatBannedUntil);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(senderId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_target ON chat_messages(targetId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles(attackerId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles(defenderId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_duration ON jobs(duration);
`);
// ---------- Начальные предметы (если таблица пуста) ----------
const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM items').get().cnt;
if (itemCount === 0) {
    const initialItems = [
        { name: 'Серый шлем', slot: 'helmet', rarity: 0, bonuses: { s: 0, a: 0, d: 5, m: 0 }, extra: { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 } },
        { name: 'Белый меч', slot: 'weapon1', rarity: 1, bonuses: { s: 10, a: 0, d: 0, m: 0 }, extra: { stamReg: 0, crit: 2, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 } },
        { name: 'Зелёное кольцо', slot: 'ring1', rarity: 2, bonuses: { s: 0, a: 15, d: 0, m: 0 }, extra: { stamReg: 1, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 } },
        { name: 'Синий амулет', slot: 'amulet', rarity: 3, bonuses: { s: 0, a: 0, d: 0, m: 20 }, extra: { stamReg: 0, crit: 0, dodge: 5, counter: 0, fullBlock: 0, hpRegen: 0 } },
        { name: 'Фиолетовые перчатки', slot: 'gloves', rarity: 4, bonuses: { s: 15, a: 0, d: 0, m: 0 }, extra: { stamReg: 0, crit: 5, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 } },
        { name: 'Жёлтый пояс', slot: 'belt', rarity: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { stamReg: 2, crit: 0, dodge: 0, counter: 10, fullBlock: 0, hpRegen: 0 } },
        { name: 'Красные ботинки', slot: 'boots', rarity: 6, bonuses: { s: 0, a: 30, d: 0, m: 0 }, extra: { stamReg: 0, crit: 0, dodge: 10, counter: 0, fullBlock: 5, hpRegen: 2 } }
    ];
    const insert = db.prepare('INSERT INTO items (name, slot, rarity, bonuses, extra) VALUES (?, ?, ?, ?, ?)');
    for (const item of initialItems) {
        insert.run(item.name, item.slot, item.rarity, JSON.stringify(item.bonuses), JSON.stringify(item.extra));
    }
}
// ---------- Начальные работы (если таблица пуста) ----------
const jobCount = db.prepare('SELECT COUNT(*) as cnt FROM jobs').get().cnt;
if (jobCount === 0) {
    const insertJob = db.prepare('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)');
    insertJob.run('Помощь жителям', 'Помощь горожанам', 600, 0, 250);
    insertJob.run('Патруль городских стен', 'Обход стен', 1800, 100, 500);
    insertJob.run('Служба в карауле', 'Караул у ворот', 3600, 250, 1000);
    insertJob.run('Дальнее ополчение', 'Поход за границу', 28800, 1000, 8000);
}
// ---------- Крафтовые предметы (ресурсы) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS craft_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rarity INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    type TEXT DEFAULT 'craft'
  );
`);
// ---------- Рецепты крафта ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS craft_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    money_cost INTEGER NOT NULL DEFAULT 0
  );
`);
// ---------- Категории рецептов ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS craft_recipe_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0
  );
`);
// ---------- Ингредиенты рецептов ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS craft_recipe_ingredients (
    recipe_id INTEGER NOT NULL,
    craft_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (recipe_id, craft_item_id),
    FOREIGN KEY (recipe_id) REFERENCES craft_recipes(id),
    FOREIGN KEY (craft_item_id) REFERENCES craft_items(id)
  );
`);
// ---------- Шансы улучшения ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS upgrade_chances (
    level INTEGER PRIMARY KEY,
    chance INTEGER NOT NULL DEFAULT 100,
    money_cost INTEGER NOT NULL DEFAULT 100
  );
`);
// ---------- Индексы ----------
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_craft_items_rarity ON craft_items(rarity);
  CREATE INDEX IF NOT EXISTS idx_craft_recipe_ingredients_recipe ON craft_recipe_ingredients(recipe_id);
`);
// ---------- Начальные ресурсы (материалы) ----------
const craftItemCount = db.prepare('SELECT COUNT(*) as cnt FROM craft_items').get().cnt;
if (craftItemCount === 0) {
    const insertCraft = db.prepare('INSERT INTO craft_items (name, rarity, type) VALUES (?, ?, ?)');
    const names = ['Серый материал', 'Белый материал', 'Зелёный материал', 'Синий материал', 'Фиолетовый материал', 'Жёлтый материал', 'Красный материал'];
    names.forEach((name, i) => insertCraft.run(name, i, 'craft'));
}
// ---------- Начальные категории рецептов ----------
const catCount = db.prepare('SELECT COUNT(*) as cnt FROM craft_recipe_categories').get().cnt;
if (catCount === 0) {
    db.prepare('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)').run('Материалы', 1);
    db.prepare('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)').run('Улучшения', 2);
}
// ---------- Начальные шансы улучшения ----------
const upgradeChanceCount = db.prepare('SELECT COUNT(*) as cnt FROM upgrade_chances').get().cnt;
if (upgradeChanceCount === 0) {
    const insertUpgrade = db.prepare('INSERT OR REPLACE INTO upgrade_chances (level, chance, money_cost) VALUES (?, ?, ?)');
    insertUpgrade.run(1, 100, 250);
    insertUpgrade.run(2, 90, 500);
    insertUpgrade.run(3, 70, 1000);
    insertUpgrade.run(4, 50, 2000);
    insertUpgrade.run(5, 25, 4000);
    insertUpgrade.run(6, 10, 8000);
    insertUpgrade.run(7, 5, 16000);
}
// ---------- Миграция старых материалов в инвентарях ----------
const usersWithMaterials = db.prepare('SELECT id, inventory FROM users WHERE inventory LIKE ?').all('%material%');
if (usersWithMaterials.length > 0) {
    const getCraftItemByRarity = db.prepare('SELECT id, name, rarity, type, image FROM craft_items WHERE rarity = ?');
    const updateUser = db.prepare('UPDATE users SET inventory = ? WHERE id = ?');
    for (const user of usersWithMaterials) {
        let inventory = JSON.parse(user.inventory || '[]');
        let changed = false;
        inventory = inventory.map((item) => {
            if (item.type === 'material' && item.rarity !== undefined) {
                const craftItem = getCraftItemByRarity.get(item.rarity);
                if (craftItem) {
                    changed = true;
                    const existingIndex = inventory.findIndex((i) => i.type === 'craft_item' && i.id === craftItem.id);
                    if (existingIndex !== -1) {
                        inventory[existingIndex].count = (inventory[existingIndex].count || 0) + (item.count || 1);
                        return null;
                    }
                    return {
                        type: 'craft_item',
                        id: craftItem.id,
                        name: craftItem.name,
                        rarity: craftItem.rarity,
                        count: item.count || 1,
                        itemType: craftItem.type || 'craft',
                        image: craftItem.image || null,
                    };
                }
            }
            return item;
        }).filter(Boolean);
        if (changed) {
            updateUser.run(JSON.stringify(inventory), user.id);
        }
    }
}
exports.default = db;
//# sourceMappingURL=database.js.map