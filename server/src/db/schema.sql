-- =============================================================================
-- PostgreSQL Schema — translated from SQLite production database
-- Generated from SQLite PRAGMA table_info
-- =============================================================================

-- ====== rarities ======
CREATE TABLE IF NOT EXISTS rarities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL
);

-- ====== floors ======
CREATE TABLE IF NOT EXISTS floors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  background TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ====== stat_names ======
CREATE TABLE IF NOT EXISTS stat_names (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  nameRu TEXT NOT NULL
);

-- ====== actions_config ======
CREATE TABLE IF NOT EXISTS actions_config (
  id SERIAL PRIMARY KEY,
  section TEXT NOT NULL DEFAULT 'world',
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  icon TEXT DEFAULT 'game-icons:castle',
  bg_image TEXT,
  path TEXT,
  cost INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- ====== items ======
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slot TEXT NOT NULL,
  rarity_id INTEGER DEFAULT 0,
  bonuses TEXT DEFAULT '{}',
  extra TEXT DEFAULT '{}',
  upgradeLevel INTEGER DEFAULT 0,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cost INTEGER
);

-- ====== craft_items ======
CREATE TABLE IF NOT EXISTS craft_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rarity_id INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'craft',
  image TEXT
);

-- ====== craft_recipe_categories ======
CREATE TABLE IF NOT EXISTS craft_recipe_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ====== craft_recipe_ingredients ======
CREATE TABLE IF NOT EXISTS craft_recipe_ingredients (
  recipe_id INTEGER NOT NULL,
  craft_item_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  PRIMARY KEY (recipe_id, craft_item_id)
);

-- ====== craft_recipes ======
CREATE TABLE IF NOT EXISTS craft_recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  money_cost INTEGER DEFAULT 0,
  result_type TEXT DEFAULT '',
  result_id INTEGER DEFAULT 0,
  success_chance INTEGER DEFAULT 100,
  category_id INTEGER
);

-- ====== upgrade_chances ======
CREATE TABLE IF NOT EXISTS upgrade_chances (
  level INTEGER NOT NULL,
  rarity_id INTEGER DEFAULT 0,
  chance INTEGER DEFAULT 100,
  money_cost INTEGER DEFAULT 100,
  PRIMARY KEY (level, rarity_id)
);

-- ====== mobs ======
CREATE TABLE IF NOT EXISTS mobs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  hp INTEGER DEFAULT 10,
  atk INTEGER DEFAULT 2,
  agi INTEGER DEFAULT 1,
  def INTEGER DEFAULT 1,
  mst INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  gold_min INTEGER DEFAULT 1,
  gold_max INTEGER DEFAULT 3,
  loot_junk REAL DEFAULT 0.8,
  loot_common REAL DEFAULT 0.2,
  loot_uncommon REAL DEFAULT 0,
  loot_rare REAL DEFAULT 0,
  loot_epic REAL DEFAULT 0,
  loot_legendary REAL DEFAULT 0,
  loot_mythic REAL DEFAULT 0,
  location TEXT DEFAULT 'Склеп',
  background TEXT,
  description TEXT
);

-- ====== jobs ======
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration INTEGER,
  rewardMin INTEGER DEFAULT 0,
  rewardMax INTEGER DEFAULT 0,
  background TEXT
);

-- ====== collection_sets ======
CREATE TABLE IF NOT EXISTS collection_sets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  bonus_percent INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ====== collection_set_items ======
CREATE TABLE IF NOT EXISTS collection_set_items (
  id SERIAL PRIMARY KEY,
  set_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  slot TEXT NOT NULL
);

-- ====== users ======
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  money INTEGER DEFAULT 0,
  totalBattles INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  inventory TEXT DEFAULT '[]',
  equipment TEXT DEFAULT '{}',
  currentHp INTEGER DEFAULT 100,
  lastHpUpdate INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
  lastAttackTime INTEGER DEFAULT 0,
  protectionUntil INTEGER DEFAULT 0,
  inventorySlots INTEGER DEFAULT 10,
  activeJob TEXT DEFAULT NULL,
  chatBannedUntil INTEGER DEFAULT 0,
  openPrivateTabs TEXT DEFAULT '[]',
  gender TEXT DEFAULT 'male',
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  statPoints INTEGER DEFAULT 0,
  baseS INTEGER DEFAULT 5,
  baseA INTEGER DEFAULT 5,
  baseD INTEGER DEFAULT 5,
  baseM INTEGER DEFAULT 5,
  failedLogins INTEGER DEFAULT 0,
  lockedUntil INTEGER DEFAULT 0,
  email TEXT,
  emailVerified INTEGER DEFAULT 0,
  emailCode TEXT,
  emailCodeExpires INTEGER DEFAULT 0,
  oauthProvider TEXT,
  oauthId TEXT,
  lastPveAttackTime INTEGER DEFAULT 0,
  bank INTEGER DEFAULT 0,
  lastBankVisit INTEGER DEFAULT 0,
  roomType TEXT DEFAULT NULL,
  roomUntil INTEGER DEFAULT 0,
  activeDrink TEXT DEFAULT NULL,
  drinkUntil INTEGER DEFAULT 0,
  elo INTEGER DEFAULT 1000,
  seasonWins INTEGER DEFAULT 0,
  seasonLosses INTEGER DEFAULT 0,
  lastEloDecay INTEGER DEFAULT 0,
  bannedUntil INTEGER DEFAULT 0,
  lastLoginAt TIMESTAMPTZ,
  lastPvpTime INTEGER DEFAULT 0,
  lastPveRatingTime INTEGER DEFAULT 0,
  lastBossKillDate TEXT DEFAULT NULL,
  pveRating INTEGER DEFAULT 0,
  premiumUntil INTEGER DEFAULT 0,
  isGuest INTEGER DEFAULT 0,
  pveTotalBattles INTEGER DEFAULT 0,
  pveWins INTEGER DEFAULT 0,
  tournamentCount INTEGER DEFAULT 0,
  tournamentWins INTEGER DEFAULT 0,
  totalJobMoney INTEGER DEFAULT 0,
  totalPveMoneyWon INTEGER DEFAULT 0,
  totalPvpMoneyWon INTEGER DEFAULT 0,
  totalPveMoneyLost INTEGER DEFAULT 0,
  totalPvpMoneyLost INTEGER DEFAULT 0,
  tournamentElo INTEGER DEFAULT 1000,
  accountNumber TEXT,
  craftCount INTEGER DEFAULT 0,
  auctionTrades INTEGER DEFAULT 0,
  totalJobSeconds INTEGER DEFAULT 0,
  craftCreated INTEGER DEFAULT 0,
  craftUpgraded INTEGER DEFAULT 0,
  craftBroken INTEGER DEFAULT 0,
  guildId INTEGER DEFAULT NULL,
  avatar TEXT,
  arenaOpponentId INTEGER DEFAULT NULL
);

-- ====== admins ======
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== guilds ======
CREATE TABLE IF NOT EXISTS guilds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  leaderId INTEGER NOT NULL,
  joinType TEXT DEFAULT 'open',
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  treasury INTEGER DEFAULT 0,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  taxRate INTEGER DEFAULT 0
);

-- ====== guild_members ======
CREATE TABLE IF NOT EXISTS guild_members (
  guildId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  rank TEXT DEFAULT 'member',
  joinedAt TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guildId, userId)
);

-- ====== guild_invites ======
CREATE TABLE IF NOT EXISTS guild_invites (
  id SERIAL PRIMARY KEY,
  guildId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  invitedBy INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== guild_treasury_log ======
CREATE TABLE IF NOT EXISTS guild_treasury_log (
  id SERIAL PRIMARY KEY,
  guildId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  type TEXT DEFAULT 'deposit'
);

-- ====== guild_wars ======
CREATE TABLE IF NOT EXISTS guild_wars (
  id SERIAL PRIMARY KEY,
  attackerGuildId INTEGER NOT NULL,
  defenderGuildId INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  declaredAt TEXT NOT NULL,
  acceptedAt TEXT,
  expiresAt TEXT NOT NULL,
  endedAt TEXT,
  winnerGuildId INTEGER,
  attackerScore INTEGER DEFAULT 0,
  defenderScore INTEGER DEFAULT 0
);

-- ====== guild_war_attacks ======
CREATE TABLE IF NOT EXISTS guild_war_attacks (
  id SERIAL PRIMARY KEY,
  warId INTEGER NOT NULL,
  attackerId INTEGER NOT NULL,
  defenderId INTEGER NOT NULL,
  attackerGuildId INTEGER NOT NULL,
  defenderGuildId INTEGER NOT NULL,
  won INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  battleLog TEXT
);

-- ====== orders ======
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  masterId INTEGER NOT NULL,
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  treasury INTEGER DEFAULT 0,
  taxRate INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL
);

-- ====== order_members ======
CREATE TABLE IF NOT EXISTS order_members (
  id SERIAL PRIMARY KEY,
  orderId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  rank TEXT DEFAULT 'recruit',
  joinedAt INTEGER NOT NULL
);

-- ====== battles ======
CREATE TABLE IF NOT EXISTS battles (
  id SERIAL PRIMARY KEY,
  attackerId INTEGER NOT NULL,
  defenderId INTEGER NOT NULL,
  winnerId INTEGER NOT NULL,
  log TEXT DEFAULT '[]',
  steps TEXT DEFAULT '[]',
  attackerHpAfter INTEGER,
  defenderHpAfter INTEGER,
  expGained INTEGER DEFAULT 0,
  moneyGained INTEGER DEFAULT 0,
  moneyStolen INTEGER DEFAULT 0,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== pve_battles ======
CREATE TABLE IF NOT EXISTS pve_battles (
  id SERIAL PRIMARY KEY,
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
  itemsDropped TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  premiumBonus INTEGER DEFAULT 0
);

-- ====== chat_messages ======
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  senderId INTEGER NOT NULL,
  targetId INTEGER,
  content TEXT NOT NULL,
  item_data TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== transfers ======
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  fromUserId INTEGER NOT NULL,
  toUserId INTEGER NOT NULL,
  fromAccount TEXT NOT NULL,
  toAccount TEXT NOT NULL,
  toUsername TEXT NOT NULL,
  amount INTEGER NOT NULL,
  commission INTEGER DEFAULT 0,
  received INTEGER NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== bank_operations ======
CREATE TABLE IF NOT EXISTS bank_operations (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  commission INTEGER DEFAULT 0,
  result INTEGER NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== auction_lots ======
CREATE TABLE IF NOT EXISTS auction_lots (
  id SERIAL PRIMARY KEY,
  sellerId INTEGER NOT NULL,
  itemData TEXT NOT NULL,
  startPrice INTEGER NOT NULL,
  buyoutPrice INTEGER,
  currentBid INTEGER,
  currentBidderId INTEGER,
  duration INTEGER DEFAULT 24,
  endsAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

-- ====== login_logs ======
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  ip TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== job_history ======
CREATE TABLE IF NOT EXISTS job_history (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  jobId INTEGER NOT NULL,
  jobName TEXT NOT NULL,
  duration INTEGER NOT NULL,
  reward INTEGER NOT NULL,
  startedAt TIMESTAMPTZ NOT NULL,
  finishedAt TIMESTAMPTZ DEFAULT NOW(),
  premiumBonus INTEGER DEFAULT 0,
  xpGained INTEGER DEFAULT 0
);

-- ====== tournaments ======
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  division TEXT NOT NULL,
  status TEXT DEFAULT 'registration',
  registrationStart INTEGER NOT NULL,
  registrationEnd INTEGER NOT NULL,
  prizePool INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  type TEXT DEFAULT 'official',
  creatorId INTEGER,
  entryFee INTEGER DEFAULT 0,
  name TEXT,
  minLevel INTEGER DEFAULT 1,
  maxLevel INTEGER DEFAULT 999,
  basePool INTEGER DEFAULT 0,
  completedAt TIMESTAMPTZ
);

-- ====== tournaments_new ======
CREATE TABLE IF NOT EXISTS tournaments_new (
  id SERIAL PRIMARY KEY,
  division TEXT NOT NULL,
  status TEXT DEFAULT 'registration',
  registrationStart INTEGER NOT NULL,
  registrationEnd INTEGER NOT NULL,
  prizePool INTEGER DEFAULT 0,
  createdAt TIMESTAMPTZ NOT NULL,
  type TEXT,
  entryFee INTEGER,
  name TEXT,
  minLevel INTEGER,
  maxLevel INTEGER,
  creatorId INTEGER,
  basePool INTEGER,
  maxPlayers INTEGER,
  completedAt TIMESTAMPTZ
);

-- ====== tournament_participants ======
CREATE TABLE IF NOT EXISTS tournament_participants (
  id SERIAL PRIMARY KEY,
  tournamentId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  goldenTicket INTEGER DEFAULT 0,
  snapshotStats TEXT,
  seed INTEGER
);

-- ====== tournament_matches ======
CREATE TABLE IF NOT EXISTS tournament_matches (
  id SERIAL PRIMARY KEY,
  tournamentId INTEGER NOT NULL,
  round INTEGER NOT NULL,
  player1Id INTEGER,
  player2Id INTEGER,
  winnerId INTEGER,
  log TEXT
);

-- ====== quest_history ======
CREATE TABLE IF NOT EXISTS quest_history (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  questType TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  typeName TEXT NOT NULL,
  rewardXp INTEGER DEFAULT 0,
  rewardMoney INTEGER DEFAULT 0,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== daily_quests ======
CREATE TABLE IF NOT EXISTS daily_quests (
  id SERIAL PRIMARY KEY,
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
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- ====== feedback_messages ======
CREATE TABLE IF NOT EXISTS feedback_messages (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  username TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  read INTEGER DEFAULT 0
);

-- ====== seasons ======
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);

-- ====== hall_of_fame ======
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id SERIAL PRIMARY KEY,
  seasonId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  elo INTEGER NOT NULL,
  title TEXT,
  reward TEXT
);

-- ====== collections ======
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  itemName TEXT NOT NULL,
  slot TEXT NOT NULL,
  rarity_id INTEGER NOT NULL,
  addedAt INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
);
