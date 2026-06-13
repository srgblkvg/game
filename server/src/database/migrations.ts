import type Database from 'better-sqlite3';

export function runMigrations(db: InstanceType<typeof Database>) {
  // Блокировка аккаунта (failedLogins, lockedUntil)
  for (const col of [
    'failedLogins INTEGER DEFAULT 0',
    'lockedUntil INTEGER DEFAULT 0',
  ]) {
    try { await db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* уже существует */ }
  }

  // Миграция старых материалов в инвентарях (material → craft_item)
  const usersWithMaterials = await db.prepareAll('SELECT id, inventory FROM users WHERE inventory LIKE ?')('%material%') as any[];
  if (usersWithMaterials.length > 0) {
    const getCraftItemByRarity = db.prepare('SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ?');
    const updateUser = db.prepare('UPDATE users SET inventory = ? WHERE id = ?');

    for (const user of usersWithMaterials) {
      let inventory = JSON.parse(user.inventory || '[]');
      let changed = false;

      inventory = inventory.map((item: any) => {
        if (item.type === 'material' && item.rarity !== undefined) {
          const craftItem = getCraftItemByRarity.get(item.rarity) as any;
          if (craftItem) {
            changed = true;
            const existingIndex = inventory.findIndex((i: any) => i.type === 'craft_item' && i.id === craftItem.id);
            if (existingIndex !== -1) {
              inventory[existingIndex].count = (inventory[existingIndex].count || 0) + (item.count || 1);
              return null;
            }
            return {
              type: 'craft_item',
              id: craftItem.id,
              name: craftItem.name,
              rarity_id: craftItem.rarity_id,
              rarity_display: craftItem.display_name,
              rarity_color: craftItem.color,
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

  // Базовые характеристики и очки статов
  try { await db.exec('ALTER TABLE users ADD COLUMN statPoints INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN baseS INTEGER DEFAULT 5'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN baseA INTEGER DEFAULT 5'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN baseD INTEGER DEFAULT 5'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN baseM INTEGER DEFAULT 5'); } catch {}

  // Инициализация статов для существующих игроков (у кого NULL)
  await db.exec(`UPDATE users SET baseS = 5, baseA = 5, baseD = 5, baseM = 5
    WHERE baseS IS NULL OR baseS = 0`);

  // Email верификация
  try { await db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN emailCode TEXT'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN emailCodeExpires INTEGER DEFAULT 0'); } catch {}

  // OAuth провайдеры
  try { await db.exec('ALTER TABLE users ADD COLUMN oauthProvider TEXT'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN oauthId TEXT'); } catch {}

  // Стоимость предмета
  try { await db.exec('ALTER TABLE items ADD COLUMN cost INTEGER DEFAULT NULL'); } catch {}

  // Кулдаун PvE атак
  try { await db.exec('ALTER TABLE users ADD COLUMN lastPveAttackTime INTEGER DEFAULT 0'); } catch {}

  // Банк (сокровищница)
  try { await db.exec('ALTER TABLE users ADD COLUMN bank INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN lastBankVisit INTEGER DEFAULT 0'); } catch {}

  // Трактир: комната отдыха и напитки
  try { await db.exec('ALTER TABLE users ADD COLUMN roomType TEXT DEFAULT NULL'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN roomUntil INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN activeDrink TEXT DEFAULT NULL'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN drinkUntil INTEGER DEFAULT 0'); } catch {}

  // ELO рейтинг
  try { await db.exec('ALTER TABLE users ADD COLUMN elo INTEGER DEFAULT 1000'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN seasonWins INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN seasonLosses INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN lastEloDecay INTEGER DEFAULT 0'); } catch {}

  // Аукцион
  try { await db.exec(`CREATE TABLE IF NOT EXISTS auction_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sellerId INTEGER NOT NULL,
    itemData TEXT NOT NULL,
    startPrice INTEGER NOT NULL,
    buyoutPrice INTEGER,
    currentBid INTEGER,
    currentBidderId INTEGER,
    duration INTEGER NOT NULL DEFAULT 24,
    endsAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES users(id)
  )`); } catch {}

  try { await db.exec('CREATE INDEX IF NOT EXISTS idx_auction_lots_seller ON auction_lots(sellerId)'); } catch {}
  try { await db.exec('CREATE INDEX IF NOT EXISTS idx_auction_lots_ends ON auction_lots(endsAt)'); } catch {}

  // Турнир
  try { await db.exec(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'registration',
    registrationStart INTEGER NOT NULL,
    registrationEnd INTEGER NOT NULL,
    prizePool INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
  )`); } catch {}

  try { await db.exec(`CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournamentId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    goldenTicket INTEGER DEFAULT 0,
    snapshotStats TEXT,
    seed INTEGER,
    FOREIGN KEY (tournamentId) REFERENCES tournaments(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  try { await db.exec(`CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournamentId INTEGER NOT NULL,
    round INTEGER NOT NULL,
    player1Id INTEGER,
    player2Id INTEGER,
    winnerId INTEGER,
    log TEXT,
    FOREIGN KEY (tournamentId) REFERENCES tournaments(id)
  )`); } catch {}

  // Ордена (гильдии)
  try { await db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    masterId INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    treasury INTEGER DEFAULT 0,
    taxRate INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (masterId) REFERENCES users(id)
  )`); } catch {}

  try { await db.exec(`CREATE TABLE IF NOT EXISTS order_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    userId INTEGER NOT NULL UNIQUE,
    rank TEXT NOT NULL DEFAULT 'recruit',
    joinedAt INTEGER NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // Авто-подтверждение для пользователей без email (старые/OAuth аккаунты)
  await db.prepareRun('UPDATE users SET emailVerified = 1 WHERE email IS NULL OR email = ?')('');

  // Бан игроков админом
  try { await db.exec('ALTER TABLE users ADD COLUMN bannedUntil INTEGER DEFAULT 0'); } catch {}

  // Премиум
  try { await db.exec('ALTER TABLE users ADD COLUMN premiumUntil INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE job_history ADD COLUMN premiumBonus INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE job_history ADD COLUMN xpGained INTEGER DEFAULT 0'); } catch {}

  // Время последнего входа
  try { await db.exec('ALTER TABLE users ADD COLUMN lastLoginAt DATETIME'); } catch {}

  // Гостевые аккаунты
  try { await db.exec('ALTER TABLE users ADD COLUMN isGuest INTEGER DEFAULT 0'); } catch {}

  // Аватар пользователя
  try { await db.exec('ALTER TABLE users ADD COLUMN avatar TEXT'); } catch {}

  // Индексы для новых колонок (после миграций)
  try { await db.exec('CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(isGuest)'); } catch {}
  try { await db.exec('CREATE INDEX IF NOT EXISTS idx_users_active_job ON users(activeJob)'); } catch {}

  // Переименование weapon2 → shield в equipment игроков
  const allUsersEquip = await db.prepareAll('SELECT id, equipment FROM users')() as any[];
  for (const u of allUsersEquip) {
    let equip = JSON.parse(u.equipment || '{}');
    if (equip['weapon2']) {
      equip['shield'] = equip['weapon2'];
      delete equip['weapon2'];
      await db.prepareRun('UPDATE users SET equipment = ? WHERE id = ?')(JSON.stringify(equip), u.id);
    }
  }

  // Переименование slot='weapon2' → 'shield' в таблице предметов
  await db.prepareRun("UPDATE items SET slot = 'shield' WHERE slot = 'weapon2'")();

  // --- Рейтинговая система ---

  // Отслеживание для декай и PvE-рейтинга
  try { await db.exec('ALTER TABLE users ADD COLUMN lastPvpTime INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN lastPveRatingTime INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN lastBossKillDate TEXT DEFAULT NULL'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN pveRating INTEGER DEFAULT 0'); } catch {}

  // Таблица сезонов
  try { await db.exec(`CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  )`); } catch {}

  // Hall of Fame
  try { await db.exec(`CREATE TABLE IF NOT EXISTS hall_of_fame (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seasonId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    elo INTEGER NOT NULL,
    title TEXT,
    reward TEXT,
    FOREIGN KEY (seasonId) REFERENCES seasons(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // Создать первый сезон, если нет активного
  const activeSeason = await db.prepareGet("SELECT id FROM seasons WHERE status = 'active' LIMIT 1")() as any;
  if (!activeSeason) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const seasonName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    await db.prepareRun('INSERT INTO seasons (name, startDate, endDate) VALUES (?, ?, ?)')(seasonName, startOfMonth, endOfMonth);
  }

  // Лог IP-адресов при входе
  try { await db.exec(`CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ip TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // Индекс для быстрого поиска IP по пользователю
  try { await db.exec('CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(userId, createdAt DESC)'); } catch {}

  // Переименование материалов из старых названий в новые (из ideas)
  const materialRenames: Record<string, string> = {
    'Серый материал': 'Пыль забвения',
    'Белый материал': 'Осколок скорби',
    'Зелёный материал': 'Фрагмент ужаса',
    'Синий материал': 'Эссенция мрака',
    'Фиолетовый материал': 'Сердцевина бездны',
    'Жёлтый материал': 'Искра погибели',
    'Красный материал': 'Слеза вечности',
  };
  for (const [oldName, newName] of Object.entries(materialRenames)) {
    await db.prepareRun('UPDATE craft_items SET name = ? WHERE name = ?')(newName, oldName);
  }
  // Переименование в инвентарях
  const allUsers = await db.prepareAll('SELECT id, inventory FROM users')() as any[];
  for (const u of allUsers) {
    let inv = JSON.parse(u.inventory || '[]');
    let changed = false;
    for (const item of inv) {
      if (materialRenames[item.name]) {
        item.name = materialRenames[item.name];
        changed = true;
      }
    }
    if (changed) await db.prepareRun('UPDATE users SET inventory = ? WHERE id = ?')(JSON.stringify(inv), u.id);
  }

  // --- Расширенная статистика игроков ---
  try { await db.exec('ALTER TABLE users ADD COLUMN pveTotalBattles INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN pveWins INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN tournamentCount INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN tournamentWins INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN totalJobMoney INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN totalPveMoneyWon INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN totalPvpMoneyWon INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN totalPveMoneyLost INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN totalPvpMoneyLost INTEGER DEFAULT 0'); } catch {}

  // --- Скрытый Elo для турнирного посева ---
  try { await db.exec('ALTER TABLE users ADD COLUMN tournamentElo INTEGER DEFAULT 1000'); } catch {}

  // --- Самоорганизованные турниры ---
  try { await db.exec("ALTER TABLE tournaments ADD COLUMN type TEXT DEFAULT 'official'"); } catch {}
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN creatorId INTEGER'); } catch {}
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN entryFee INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN name TEXT'); } catch {}
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN minLevel INTEGER DEFAULT 1'); } catch {}
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN maxLevel INTEGER DEFAULT 999'); } catch {}
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN basePool INTEGER DEFAULT 0'); } catch {}

  // --- Банковские счета ---
  try { await db.exec('ALTER TABLE users ADD COLUMN accountNumber TEXT'); } catch {}
  try { await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_accountNumber ON users(accountNumber)'); } catch {}

  // --- Ежедневные квесты ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS daily_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    questType TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    requirement INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    rewardXp INTEGER DEFAULT 0,
    rewardMoney INTEGER DEFAULT 0,
    status TEXT DEFAULT 'available',
    snapshot TEXT,
    date TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  try { await db.exec('ALTER TABLE users ADD COLUMN craftCount INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN auctionTrades INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN totalJobSeconds INTEGER DEFAULT 0'); } catch {}

  // --- Статистика крафта ---
  try { await db.exec('ALTER TABLE users ADD COLUMN craftCreated INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN craftUpgraded INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN craftBroken INTEGER DEFAULT 0'); } catch {}

  // --- Унификация xpGained → expGained в pve_battles ---
  try { await db.exec('ALTER TABLE pve_battles RENAME COLUMN xpGained TO expGained'); } catch {}

  // --- История выполненных квестов ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS quest_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    questType TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    typeName TEXT NOT NULL,
    rewardXp INTEGER DEFAULT 0,
    rewardMoney INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // --- История переводов ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fromUserId INTEGER NOT NULL,
    toUserId INTEGER NOT NULL,
    fromAccount TEXT NOT NULL,
    toAccount TEXT NOT NULL,
    toUsername TEXT NOT NULL,
    amount INTEGER NOT NULL,
    commission INTEGER DEFAULT 0,
    received INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fromUserId) REFERENCES users(id),
    FOREIGN KEY (toUserId) REFERENCES users(id)
  )`); } catch {}

  // --- История банковских операций ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS bank_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    commission INTEGER DEFAULT 0,
    result INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // Генерируем счета существующим игрокам
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  function genCode(): string {
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      return code;
  }
  const usersWithout = await db.prepareAll('SELECT id FROM users WHERE accountNumber IS NULL')() as any[];
  for (const u of usersWithout) {
      let code: string;
      do { code = genCode(); } while (await db.prepareGet('SELECT id FROM users WHERE accountNumber = ?')(code));
      await db.prepareRun('UPDATE users SET accountNumber = ? WHERE id = ?')(code, u.id);
  }

  // --- История PvE-боёв ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS pve_battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    mobId INTEGER NOT NULL,
    mobName TEXT NOT NULL,
    mobLevel INTEGER NOT NULL,
    playerWon INTEGER NOT NULL,
    steps TEXT,
    expGained INTEGER DEFAULT 0,
    goldGained INTEGER DEFAULT 0,
    goldLost INTEGER DEFAULT 0,
    materialDropped TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // --- Гильдии ---
  try { await db.exec('ALTER TABLE users ADD COLUMN guildId INTEGER DEFAULT NULL REFERENCES guilds(id)'); } catch {}
  try { await db.exec(`CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    leaderId INTEGER NOT NULL,
    joinType TEXT NOT NULL DEFAULT 'open' CHECK(joinType IN ('open','request','invite')),
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    treasury INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leaderId) REFERENCES users(id)
  )`); } catch {}
  try { await db.exec(`CREATE TABLE IF NOT EXISTS guild_members (
    guildId INTEGER NOT NULL,
    userId INTEGER NOT NULL UNIQUE,
    rank TEXT NOT NULL DEFAULT 'member' CHECK(rank IN ('leader','officer','member')),
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guildId) REFERENCES guilds(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    PRIMARY KEY (guildId, userId)
  )`); } catch {}
  try { await db.exec(`CREATE TABLE IF NOT EXISTS guild_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    invitedBy INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guildId) REFERENCES guilds(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // --- Арена: запоминание выданного соперника ---
  try { await db.exec('ALTER TABLE users ADD COLUMN arenaOpponentId INTEGER DEFAULT NULL'); } catch {}

  // --- Премиум-бонус в истории PvE-боёв ---
  try { await db.exec('ALTER TABLE pve_battles ADD COLUMN premiumBonus INTEGER DEFAULT 0'); } catch {}

  // --- Фоновое изображение для работ ---
  try { await db.exec('ALTER TABLE jobs ADD COLUMN background TEXT'); } catch {}

  // --- Изображения и описания для мобов ---
  try { await db.exec('ALTER TABLE mobs ADD COLUMN background TEXT'); } catch {}
  try { await db.exec('ALTER TABLE mobs ADD COLUMN description TEXT'); } catch {}

  // --- Таблица действий (action cards) ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS actions_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL DEFAULT 'world',
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    icon TEXT DEFAULT 'game-icons:castle',
    bg_image TEXT,
    path TEXT,
    cost INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  )`); } catch {}

  // --- Таблица этажей (охоты) ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    background TEXT,
    sort_order INTEGER DEFAULT 0
  )`); } catch {}

  // --- Казна гильдии ---
  try { await db.exec('ALTER TABLE guilds ADD COLUMN treasury INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE guilds ADD COLUMN taxRate INTEGER DEFAULT 0'); } catch {}
  try { await db.exec(`CREATE TABLE IF NOT EXISTS guild_treasury_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'deposit',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`); } catch {}
  try { db.exec('ALTER TABLE guild_treasury_log ADD COLUMN type TEXT NOT NULL DEFAULT \'deposit\''); } catch {}

  // --- Гильд-войны ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS guild_wars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attackerGuildId INTEGER NOT NULL,
    defenderGuildId INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    declaredAt TEXT NOT NULL DEFAULT (datetime('now')),
    acceptedAt TEXT,
    expiresAt TEXT NOT NULL,
    endedAt TEXT,
    winnerGuildId INTEGER,
    FOREIGN KEY (attackerGuildId) REFERENCES guilds(id),
    FOREIGN KEY (defenderGuildId) REFERENCES guilds(id)
  )`); } catch {}

  // --- Атаки в гильд-войнах ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS guild_war_attacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warId INTEGER NOT NULL,
    attackerId INTEGER NOT NULL,
    defenderId INTEGER NOT NULL,
    attackerGuildId INTEGER NOT NULL,
    defenderGuildId INTEGER NOT NULL,
    won INTEGER NOT NULL DEFAULT 0,
    battleLog TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (warId) REFERENCES guild_wars(id),
    FOREIGN KEY (attackerId) REFERENCES users(id),
    FOREIGN KEY (defenderId) REFERENCES users(id)
  )`); } catch {}
  try { await db.exec('ALTER TABLE guild_wars ADD COLUMN attackerScore INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE guild_wars ADD COLUMN defenderScore INTEGER DEFAULT 0'); } catch {}
  try { await db.exec('ALTER TABLE guild_war_attacks ADD COLUMN battleLog TEXT'); } catch {}

  // --- completedAt для турниров ---
  try { await db.exec('ALTER TABLE tournaments ADD COLUMN completedAt DATETIME'); } catch {}

  // --- Меняем тип createdAt в tournaments с INTEGER на DATETIME (конвертируем на месте) ---
  {
    const colInfo = await db.prepareAll("PRAGMA table_info(tournaments)")() as any[];
    const createdAtCol = colInfo.find((c: any) => c.name === 'createdAt');
    if (createdAtCol && createdAtCol.type === 'INTEGER') {
      try {
        const oldData = await db.prepareAll('SELECT id, createdAt FROM tournaments')() as any[];
        const update = db.prepare('UPDATE tournaments SET createdAt=? WHERE id=?');
        for (const t of oldData) {
          if (typeof t.createdAt === 'number' && t.createdAt > 1000000000) {
            const s = new Date(t.createdAt * 1000).toISOString().replace('T', ' ').slice(0, 19);
            update.run(s, t.id);
          }
        }
      } catch {}
    }
  }

  // --- rarity_id в upgrade_chances (пересоздаём) ---
  // Проверяем, есть ли уже колонка rarity_id (миграция уже выполнена)
  const hasRarityCol = (await db.prepareAll("PRAGMA table_info(upgrade_chances)")() as any[]).some((c: any) => c.name === 'rarity_id');
  if (!hasRarityCol) {
    try {
      await db.exec('DROP TABLE IF EXISTS upgrade_chances_new');
      await db.exec(`CREATE TABLE upgrade_chances_new (
        level INTEGER NOT NULL,
        rarity_id INTEGER NOT NULL DEFAULT 0,
        chance INTEGER NOT NULL DEFAULT 100,
        money_cost INTEGER NOT NULL DEFAULT 100,
        PRIMARY KEY (level, rarity_id)
      )`);
      // Переносим старые данные (rarity_id = 0 для совместимости)
      const old = await db.prepareAll('SELECT * FROM upgrade_chances')() as any[];
      for (const r of old) {
        await db.prepareRun('INSERT OR REPLACE INTO upgrade_chances_new (level, rarity_id, chance, money_cost) VALUES (?, ?, ?, ?)')(r.level, 0, r.chance, r.money_cost);
      }
      await db.exec('DROP TABLE upgrade_chances');
      await db.exec('ALTER TABLE upgrade_chances_new RENAME TO upgrade_chances');
    } catch {}
  }

  // --- Обратная связь ---
  try { await db.exec(`CREATE TABLE IF NOT EXISTS feedback_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    username TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    read INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // --- Системный пользователь для автосообщений (турниры, чат) ---
  await db.prepareRun('INSERT OR IGNORE INTO users (id, username, passwordHash, currentHp) VALUES (?, ?, ?, ?)')(0, 'system', 'system', 100);
}
