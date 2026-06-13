import pool from './pg';

export async function runSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        email TEXT,
        emailVerified INTEGER DEFAULT 0,
        emailCode TEXT,
        emailCodeExpires INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        money INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        lastBankVisit INTEGER DEFAULT 0,
        totalBattles INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        pveTotalBattles INTEGER DEFAULT 0,
        pveWins INTEGER DEFAULT 0,
        inventory TEXT DEFAULT '[]',
        equipment TEXT DEFAULT '{}',
        currentHp INTEGER DEFAULT 100,
        maxHp INTEGER DEFAULT 100,
        lastHpUpdate INTEGER DEFAULT 0,
        lastAttackTime INTEGER DEFAULT 0,
        lastPveAttackTime INTEGER DEFAULT 0,
        lastPvpTime INTEGER DEFAULT 0,
        protectionUntil INTEGER DEFAULT 0,
        baseS INTEGER DEFAULT 5,
        baseA INTEGER DEFAULT 5,
        baseD INTEGER DEFAULT 5,
        baseM INTEGER DEFAULT 5,
        statPoints INTEGER DEFAULT 0,
        inventorySlots INTEGER DEFAULT 10,
        activeJob TEXT,
        role TEXT DEFAULT 'player',
        isGuest INTEGER DEFAULT 0,
        gender TEXT DEFAULT 'male',
        avatar TEXT,
        guildId INTEGER,
        guildName TEXT,
        elo INTEGER DEFAULT 1000,
        pveRating INTEGER DEFAULT 0,
        seasonWins INTEGER DEFAULT 0,
        seasonLosses INTEGER DEFAULT 0,
        tournamentCount INTEGER DEFAULT 0,
        tournamentWins INTEGER DEFAULT 0,
        totalJobMoney INTEGER DEFAULT 0,
        totalJobSeconds INTEGER DEFAULT 0,
        totalPveMoneyWon INTEGER DEFAULT 0,
        totalPvpMoneyWon INTEGER DEFAULT 0,
        totalPveMoneyLost INTEGER DEFAULT 0,
        totalPvpMoneyLost INTEGER DEFAULT 0,
        craftCreated INTEGER DEFAULT 0,
        craftUpgraded INTEGER DEFAULT 0,
        craftBroken INTEGER DEFAULT 0,
        failedLogins INTEGER DEFAULT 0,
        lockedUntil INTEGER DEFAULT 0,
        bannedUntil INTEGER DEFAULT 0,
        chatBannedUntil INTEGER DEFAULT 0,
        roomType TEXT,
        roomUntil INTEGER DEFAULT 0,
        activeDrink TEXT,
        drinkUntil INTEGER DEFAULT 0,
        premiumUntil INTEGER DEFAULT 0,
        openPrivateTabs TEXT DEFAULT '[]',
        arenaOpponentId INTEGER,
        lastLoginAt INTEGER DEFAULT 0,
        oauthProvider TEXT,
        oauthId TEXT,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rarities (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slot TEXT NOT NULL,
        rarity_id INTEGER NOT NULL DEFAULT 0,
        bonuses TEXT DEFAULT '{}',
        extra TEXT DEFAULT '{}',
        image TEXT,
        cost INTEGER DEFAULT 0,
        FOREIGN KEY (rarity_id) REFERENCES rarities(id)
      );

      CREATE TABLE IF NOT EXISTS craft_items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        rarity_id INTEGER NOT NULL DEFAULT 0,
        type TEXT DEFAULT 'craft',
        image TEXT,
        FOREIGN KEY (rarity_id) REFERENCES rarities(id)
      );

      CREATE TABLE IF NOT EXISTS craft_recipe_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS craft_recipes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        money_cost INTEGER DEFAULT 0,
        result_type TEXT NOT NULL,
        result_id INTEGER NOT NULL DEFAULT 0,
        success_chance INTEGER DEFAULT 100,
        category_id INTEGER,
        FOREIGN KEY (category_id) REFERENCES craft_recipe_categories(id)
      );

      CREATE TABLE IF NOT EXISTS craft_recipe_ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER NOT NULL,
        craft_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (recipe_id) REFERENCES craft_recipes(id),
        FOREIGN KEY (craft_item_id) REFERENCES craft_items(id)
      );

      CREATE TABLE IF NOT EXISTS upgrade_chances (
        level INTEGER NOT NULL,
        rarity_id INTEGER NOT NULL DEFAULT 0,
        chance INTEGER NOT NULL DEFAULT 50,
        money_cost INTEGER NOT NULL DEFAULT 100,
        PRIMARY KEY (level, rarity_id)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        duration INTEGER NOT NULL,
        rewardMin INTEGER NOT NULL DEFAULT 0,
        rewardMax INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS job_history (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        jobId INTEGER NOT NULL,
        jobName TEXT NOT NULL,
        duration INTEGER NOT NULL,
        reward INTEGER NOT NULL,
        startedAt TEXT NOT NULL,
        premiumBonus INTEGER DEFAULT 0,
        xpGained INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS mobs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        hp INTEGER NOT NULL DEFAULT 10,
        atk INTEGER NOT NULL DEFAULT 1,
        agi INTEGER NOT NULL DEFAULT 1,
        def INTEGER NOT NULL DEFAULT 1,
        mst INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        gold_min INTEGER NOT NULL DEFAULT 0,
        gold_max INTEGER NOT NULL DEFAULT 0,
        loot_junk REAL DEFAULT 0,
        loot_common REAL DEFAULT 0,
        loot_uncommon REAL DEFAULT 0,
        loot_rare REAL DEFAULT 0,
        loot_epic REAL DEFAULT 0,
        loot_legendary REAL DEFAULT 0,
        loot_mythic REAL DEFAULT 0,
        location TEXT DEFAULT '',
        background TEXT,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS floors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        background TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS actions_config (
        id SERIAL PRIMARY KEY,
        section TEXT NOT NULL DEFAULT 'world',
        title TEXT NOT NULL,
        subtitle TEXT DEFAULT '',
        icon TEXT DEFAULT '',
        bg_image TEXT,
        path TEXT,
        cost INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS battles (
        id SERIAL PRIMARY KEY,
        attackerId INTEGER NOT NULL,
        defenderId INTEGER NOT NULL,
        winnerId INTEGER,
        steps TEXT DEFAULT '[]',
        attackerHpAfter INTEGER,
        defenderHpAfter INTEGER,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS pve_battles (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        mobId INTEGER NOT NULL,
        mobName TEXT NOT NULL,
        mobLevel INTEGER NOT NULL,
        playerWon INTEGER NOT NULL DEFAULT 0,
        steps TEXT DEFAULT '[]',
        expGained INTEGER DEFAULT 0,
        goldGained INTEGER DEFAULT 0,
        goldLost INTEGER DEFAULT 0,
        materialDropped TEXT,
        premiumBonus INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        senderId INTEGER NOT NULL,
        targetId INTEGER,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'global',
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS guilds (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        leaderId INTEGER NOT NULL,
        taxRate INTEGER DEFAULT 0,
        treasury INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS guild_members (
        id SERIAL PRIMARY KEY,
        guildId INTEGER NOT NULL,
        userId INTEGER NOT NULL UNIQUE,
        FOREIGN KEY (guildId) REFERENCES guilds(id)
      );

      CREATE TABLE IF NOT EXISTS guild_treasury_log (
        id SERIAL PRIMARY KEY,
        guildId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS guild_wars (
        id SERIAL PRIMARY KEY,
        attackerGuildId INTEGER NOT NULL,
        defenderGuildId INTEGER NOT NULL,
        attackerUserId INTEGER NOT NULL,
        defenderUserId INTEGER NOT NULL,
        winnerGuildId INTEGER,
        steps TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS tournament (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')),
        startedAt TEXT,
        endedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS tournament_participants (
        id SERIAL PRIMARY KEY,
        tournamentId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        registeredAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS tournament_matches (
        id SERIAL PRIMARY KEY,
        tournamentId INTEGER NOT NULL,
        round INTEGER NOT NULL,
        player1Id INTEGER,
        player2Id INTEGER,
        winnerId INTEGER,
        log TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS arena_opponents (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        opponentId INTEGER NOT NULL,
        difficulty TEXT DEFAULT 'equal',
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS bank_transfers (
        id SERIAL PRIMARY KEY,
        fromUserId INTEGER NOT NULL,
        toUserId INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        commission INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS auction_lots (
        id SERIAL PRIMARY KEY,
        sellerId INTEGER NOT NULL,
        item TEXT NOT NULL,
        startPrice INTEGER NOT NULL,
        buyoutPrice INTEGER,
        endsAt INTEGER NOT NULL,
        buyerId INTEGER,
        soldAt INTEGER,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        buyerId INTEGER NOT NULL,
        sellerId INTEGER,
        itemName TEXT NOT NULL,
        slot TEXT NOT NULL,
        rarity_id INTEGER NOT NULL,
        price INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS stat_names (
        name TEXT PRIMARY KEY,
        nameRu TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_quests (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        questType TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        requirement INTEGER NOT NULL,
        rewardXp INTEGER NOT NULL,
        rewardMoney INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        snapshot TEXT DEFAULT '{}',
        date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        userId INTEGER,
        username TEXT NOT NULL,
        ip TEXT NOT NULL,
        success INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        slot TEXT NOT NULL,
        rarity_id INTEGER NOT NULL,
        addedAt INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id),
        UNIQUE(userId, itemName, slot)
      );

      CREATE TABLE IF NOT EXISTS collection_sets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        bonus_percent INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS collection_set_items (
        id SERIAL PRIMARY KEY,
        set_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        slot TEXT NOT NULL,
        FOREIGN KEY (set_id) REFERENCES collection_sets(id) ON DELETE CASCADE,
        UNIQUE(set_id, item_name, slot)
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS feedback_messages (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        username TEXT NOT NULL,
        subject TEXT DEFAULT '',
        message TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS quest_history (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        questType TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        typeName TEXT DEFAULT '',
        rewardXp INTEGER DEFAULT 0,
        rewardMoney INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        createdAt TEXT DEFAULT (TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      );

      CREATE TABLE IF NOT EXISTS hall_of_fame (
        id SERIAL PRIMARY KEY,
        seasonId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        elo INTEGER DEFAULT 1000,
        title TEXT,
        FOREIGN KEY (seasonId) REFERENCES seasons(id)
      );
    `);

    // Индексы
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_wins ON users(wins DESC);
      CREATE INDEX IF NOT EXISTS idx_users_chat_banned ON users(chatBannedUntil);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(senderId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_target ON chat_messages(targetId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles(attackerId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles(defenderId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_duration ON jobs(duration);
      CREATE INDEX IF NOT EXISTS idx_craft_items_rarity_id ON craft_items(rarity_id);
      CREATE INDEX IF NOT EXISTS idx_craft_recipe_ingredients_recipe ON craft_recipe_ingredients(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_pve_battles_user ON pve_battles(userId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournamentId, round);
      CREATE INDEX IF NOT EXISTS idx_guild_treasury_log_guild ON guild_treasury_log(guildId, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_auction_lots_ends ON auction_lots(endsAt);
      CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(userId);
      CREATE INDEX IF NOT EXISTS idx_collection_set_items_set ON collection_set_items(set_id);
      CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(userId, createdAt DESC);
    `);

    console.log('[PG] Schema created');
  } finally {
    client.release();
  }
}
