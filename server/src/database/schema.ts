import type Database from 'better-sqlite3';

export function runSchema(db: InstanceType<typeof Database>) {
  // Таблица пользователей
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
      openPrivateTabs TEXT DEFAULT '[]',
      gender TEXT DEFAULT 'male',
      statPoints INTEGER DEFAULT 0,
      baseS INTEGER DEFAULT 5,
      baseA INTEGER DEFAULT 5,
      baseD INTEGER DEFAULT 5,
      baseM INTEGER DEFAULT 5,
      email TEXT,
      emailVerified INTEGER DEFAULT 0,
      emailCode TEXT,
      emailCodeExpires INTEGER DEFAULT 0,
      failedLogins INTEGER DEFAULT 0,
      lockedUntil INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица администраторов
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица редкостей
  db.exec(`
    CREATE TABLE IF NOT EXISTS rarities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      color TEXT NOT NULL
    );
  `);

  // Таблица боёв
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

  // Таблица работ
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

  // Таблица истории работ
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

  // Таблица предметов
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slot TEXT NOT NULL,
      rarity_id INTEGER NOT NULL DEFAULT 0,
      bonuses TEXT DEFAULT '{}',
      extra TEXT DEFAULT '{}',
      upgradeLevel INTEGER DEFAULT 0,
      image TEXT DEFAULT NULL,
      cost INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rarity_id) REFERENCES rarities(id)
    )
  `);

  // Таблица сообщений чата
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

  // Крафтовые предметы (ресурсы)
  db.exec(`
    CREATE TABLE IF NOT EXISTS craft_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rarity_id INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'craft',
      image TEXT DEFAULT NULL,
      FOREIGN KEY (rarity_id) REFERENCES rarities(id)
    );
  `);

  // Рецепты крафта
  db.exec(`
    CREATE TABLE IF NOT EXISTS craft_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      money_cost INTEGER NOT NULL DEFAULT 0,
      result_type TEXT DEFAULT '',
      result_id INTEGER DEFAULT 0,
      success_chance INTEGER DEFAULT 100,
      category_id INTEGER DEFAULT NULL
    );
  `);

  // Категории рецептов
  db.exec(`
    CREATE TABLE IF NOT EXISTS craft_recipe_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Ингредиенты рецептов
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

  // Шансы улучшения
  db.exec(`
    CREATE TABLE IF NOT EXISTS upgrade_chances (
      level INTEGER PRIMARY KEY,
      chance INTEGER NOT NULL DEFAULT 100,
      money_cost INTEGER NOT NULL DEFAULT 100
    );
  `);

  // Таблица названий характеристик
  db.exec(`
    CREATE TABLE IF NOT EXISTS stat_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      nameRu TEXT NOT NULL
    )
  `);

  // Таблица мобов (PvE)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      hp INTEGER NOT NULL DEFAULT 10,
      atk INTEGER NOT NULL DEFAULT 2,
      agi INTEGER NOT NULL DEFAULT 1,
      def INTEGER NOT NULL DEFAULT 1,
      mst INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      gold_min INTEGER NOT NULL DEFAULT 1,
      gold_max INTEGER NOT NULL DEFAULT 3,
      loot_junk REAL NOT NULL DEFAULT 0.8,
      loot_common REAL NOT NULL DEFAULT 0.2,
      loot_uncommon REAL NOT NULL DEFAULT 0,
      loot_rare REAL NOT NULL DEFAULT 0,
      loot_epic REAL NOT NULL DEFAULT 0,
      loot_legendary REAL NOT NULL DEFAULT 0,
      loot_mythic REAL NOT NULL DEFAULT 0,
      location TEXT DEFAULT 'Склеп'
    )
  `);

  // Индексы
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_wins ON users(wins DESC);
    CREATE INDEX IF NOT EXISTS idx_users_chat_banned ON users(chatBannedUntil);
    CREATE INDEX IF NOT EXISTS idx_users_active_job ON users(activeJob);
    CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(isGuest);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(senderId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_target ON chat_messages(targetId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles(attackerId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles(defenderId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_duration ON jobs(duration);
    CREATE INDEX IF NOT EXISTS idx_craft_items_rarity_id ON craft_items(rarity_id);
    CREATE INDEX IF NOT EXISTS idx_craft_recipe_ingredients_recipe ON craft_recipe_ingredients(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_auction_lots_seller ON auction_lots(sellerId);
    CREATE INDEX IF NOT EXISTS idx_auction_lots_ends ON auction_lots(endsAt);
    CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(userId, createdAt DESC);
  `);
}
