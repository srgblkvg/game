import type Database from 'better-sqlite3';

export function runMigrations(db: InstanceType<typeof Database>) {
  // Блокировка аккаунта (failedLogins, lockedUntil)
  for (const col of [
    'failedLogins INTEGER DEFAULT 0',
    'lockedUntil INTEGER DEFAULT 0',
  ]) {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* уже существует */ }
  }

  // Миграция старых материалов в инвентарях (material → craft_item)
  const usersWithMaterials = db.prepare('SELECT id, inventory FROM users WHERE inventory LIKE ?').all('%material%') as any[];
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
  try { db.exec('ALTER TABLE users ADD COLUMN statPoints INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseS INTEGER DEFAULT 5'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseA INTEGER DEFAULT 5'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseD INTEGER DEFAULT 5'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseM INTEGER DEFAULT 5'); } catch {}

  // Инициализация статов для существующих игроков (у кого NULL)
  db.exec(`UPDATE users SET baseS = 5, baseA = 5, baseD = 5, baseM = 5
    WHERE baseS IS NULL OR baseS = 0`);

  // Email верификация
  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN emailCode TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN emailCodeExpires INTEGER DEFAULT 0'); } catch {}

  // OAuth провайдеры
  try { db.exec('ALTER TABLE users ADD COLUMN oauthProvider TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN oauthId TEXT'); } catch {}

  // Стоимость предмета
  try { db.exec('ALTER TABLE items ADD COLUMN cost INTEGER DEFAULT NULL'); } catch {}

  // Кулдаун PvE атак
  try { db.exec('ALTER TABLE users ADD COLUMN lastPveAttackTime INTEGER DEFAULT 0'); } catch {}

  // Банк (сокровищница)
  try { db.exec('ALTER TABLE users ADD COLUMN bank INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN lastBankVisit INTEGER DEFAULT 0'); } catch {}

  // Трактир: комната отдыха и напитки
  try { db.exec('ALTER TABLE users ADD COLUMN roomType TEXT DEFAULT NULL'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN roomUntil INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN activeDrink TEXT DEFAULT NULL'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN drinkUntil INTEGER DEFAULT 0'); } catch {}

  // ELO рейтинг
  try { db.exec('ALTER TABLE users ADD COLUMN elo INTEGER DEFAULT 1000'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN seasonWins INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN seasonLosses INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN lastEloDecay INTEGER DEFAULT 0'); } catch {}

  // Аукцион
  try { db.exec(`CREATE TABLE IF NOT EXISTS auction_lots (
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

  try { db.exec('CREATE INDEX IF NOT EXISTS idx_auction_lots_seller ON auction_lots(sellerId)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_auction_lots_ends ON auction_lots(endsAt)'); } catch {}

  // Турнир
  try { db.exec(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'registration',
    registrationStart INTEGER NOT NULL,
    registrationEnd INTEGER NOT NULL,
    prizePool INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
  )`); } catch {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournamentId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    goldenTicket INTEGER DEFAULT 0,
    snapshotStats TEXT,
    seed INTEGER,
    FOREIGN KEY (tournamentId) REFERENCES tournaments(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS tournament_matches (
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
  try { db.exec(`CREATE TABLE IF NOT EXISTS orders (
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

  try { db.exec(`CREATE TABLE IF NOT EXISTS order_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    userId INTEGER NOT NULL UNIQUE,
    rank TEXT NOT NULL DEFAULT 'recruit',
    joinedAt INTEGER NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // Авто-подтверждение для пользователей без email (старые/OAuth аккаунты)
  db.prepare('UPDATE users SET emailVerified = 1 WHERE email IS NULL OR email = ?').run('');

  // Бан игроков админом
  try { db.exec('ALTER TABLE users ADD COLUMN bannedUntil INTEGER DEFAULT 0'); } catch {}

  // Премиум
  try { db.exec('ALTER TABLE users ADD COLUMN premiumUntil INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE job_history ADD COLUMN premiumBonus INTEGER DEFAULT 0'); } catch {}

  // Время последнего входа
  try { db.exec('ALTER TABLE users ADD COLUMN lastLoginAt DATETIME'); } catch {}

  // Гостевые аккаунты
  try { db.exec('ALTER TABLE users ADD COLUMN isGuest INTEGER DEFAULT 0'); } catch {}

  // Аватар пользователя
  try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT'); } catch {}

  // Индексы для новых колонок (после миграций)
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(isGuest)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_active_job ON users(activeJob)'); } catch {}

  // Переименование weapon2 → shield в equipment игроков
  const allUsersEquip = db.prepare('SELECT id, equipment FROM users').all() as any[];
  for (const u of allUsersEquip) {
    let equip = JSON.parse(u.equipment || '{}');
    if (equip['weapon2']) {
      equip['shield'] = equip['weapon2'];
      delete equip['weapon2'];
      db.prepare('UPDATE users SET equipment = ? WHERE id = ?').run(JSON.stringify(equip), u.id);
    }
  }

  // Переименование slot='weapon2' → 'shield' в таблице предметов
  db.prepare("UPDATE items SET slot = 'shield' WHERE slot = 'weapon2'").run();

  // --- Рейтинговая система ---

  // Отслеживание для декай и PvE-рейтинга
  try { db.exec('ALTER TABLE users ADD COLUMN lastPvpTime INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN lastPveRatingTime INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN lastBossKillDate TEXT DEFAULT NULL'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN pveRating INTEGER DEFAULT 0'); } catch {}

  // Таблица сезонов
  try { db.exec(`CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  )`); } catch {}

  // Hall of Fame
  try { db.exec(`CREATE TABLE IF NOT EXISTS hall_of_fame (
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
  const activeSeason = db.prepare("SELECT id FROM seasons WHERE status = 'active' LIMIT 1").get() as any;
  if (!activeSeason) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const seasonName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    db.prepare('INSERT INTO seasons (name, startDate, endDate) VALUES (?, ?, ?)').run(seasonName, startOfMonth, endOfMonth);
  }

  // Лог IP-адресов при входе
  try { db.exec(`CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ip TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // Индекс для быстрого поиска IP по пользователю
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(userId, createdAt DESC)'); } catch {}

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
    db.prepare('UPDATE craft_items SET name = ? WHERE name = ?').run(newName, oldName);
  }
  // Переименование в инвентарях
  const allUsers = db.prepare('SELECT id, inventory FROM users').all() as any[];
  for (const u of allUsers) {
    let inv = JSON.parse(u.inventory || '[]');
    let changed = false;
    for (const item of inv) {
      if (materialRenames[item.name]) {
        item.name = materialRenames[item.name];
        changed = true;
      }
    }
    if (changed) db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inv), u.id);
  }

  // --- Расширенная статистика игроков ---
  try { db.exec('ALTER TABLE users ADD COLUMN pveTotalBattles INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN pveWins INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN tournamentCount INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN tournamentWins INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN totalJobMoney INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN totalPveMoneyWon INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN totalPvpMoneyWon INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN totalPveMoneyLost INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN totalPvpMoneyLost INTEGER DEFAULT 0'); } catch {}

  // --- Скрытый Elo для турнирного посева ---
  try { db.exec('ALTER TABLE users ADD COLUMN tournamentElo INTEGER DEFAULT 1000'); } catch {}

  // --- Самоорганизованные турниры ---
  try { db.exec("ALTER TABLE tournaments ADD COLUMN type TEXT DEFAULT 'official'"); } catch {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN creatorId INTEGER'); } catch {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN entryFee INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN name TEXT'); } catch {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN minLevel INTEGER DEFAULT 1'); } catch {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN maxLevel INTEGER DEFAULT 999'); } catch {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN basePool INTEGER DEFAULT 0'); } catch {}

  // --- Банковские счета ---
  try { db.exec('ALTER TABLE users ADD COLUMN accountNumber TEXT'); } catch {}
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_accountNumber ON users(accountNumber)'); } catch {}

  // --- Ежедневные квесты ---
  try { db.exec(`CREATE TABLE IF NOT EXISTS daily_quests (
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

  try { db.exec('ALTER TABLE users ADD COLUMN craftCount INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN auctionTrades INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN totalJobSeconds INTEGER DEFAULT 0'); } catch {}

  // --- Статистика крафта ---
  try { db.exec('ALTER TABLE users ADD COLUMN craftCreated INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN craftUpgraded INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN craftBroken INTEGER DEFAULT 0'); } catch {}

  // --- Унификация xpGained → expGained в pve_battles ---
  try { db.exec('ALTER TABLE pve_battles RENAME COLUMN xpGained TO expGained'); } catch {}

  // --- История выполненных квестов ---
  try { db.exec(`CREATE TABLE IF NOT EXISTS quest_history (
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
  try { db.exec(`CREATE TABLE IF NOT EXISTS transfers (
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
  try { db.exec(`CREATE TABLE IF NOT EXISTS bank_operations (
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
  const usersWithout = db.prepare('SELECT id FROM users WHERE accountNumber IS NULL').all() as any[];
  for (const u of usersWithout) {
      let code: string;
      do { code = genCode(); } while (db.prepare('SELECT id FROM users WHERE accountNumber = ?').get(code));
      db.prepare('UPDATE users SET accountNumber = ? WHERE id = ?').run(code, u.id);
  }

  // --- История PvE-боёв ---
  try { db.exec(`CREATE TABLE IF NOT EXISTS pve_battles (
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
  try { db.exec('ALTER TABLE users ADD COLUMN guildId INTEGER DEFAULT NULL REFERENCES guilds(id)'); } catch {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS guilds (
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
  try { db.exec(`CREATE TABLE IF NOT EXISTS guild_members (
    guildId INTEGER NOT NULL,
    userId INTEGER NOT NULL UNIQUE,
    rank TEXT NOT NULL DEFAULT 'member' CHECK(rank IN ('leader','officer','member')),
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guildId) REFERENCES guilds(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    PRIMARY KEY (guildId, userId)
  )`); } catch {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS guild_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    invitedBy INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guildId) REFERENCES guilds(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`); } catch {}

  // --- Системный пользователь для автосообщений (турниры, чат) ---
  db.prepare('INSERT OR IGNORE INTO users (id, username, passwordHash, currentHp) VALUES (?, ?, ?, ?)').run(0, 'system', 'system', 100);
}
