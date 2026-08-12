-- Гильд-боссы и таланты

-- Состояние босса гильдии (одна запись на гильдию)
CREATE TABLE IF NOT EXISTS guild_bosses (
  guildId INTEGER PRIMARY KEY REFERENCES guilds(id),
  killCount INTEGER DEFAULT 0,
  currentHp INTEGER NOT NULL,
  maxHp INTEGER NOT NULL,
  atk INTEGER NOT NULL,
  agi INTEGER NOT NULL,
  def INTEGER NOT NULL,
  mst INTEGER NOT NULL,
  level INTEGER NOT NULL,
  effects TEXT DEFAULT '[]'
);

-- Кулдаун атаки босса и очки талантов у членов гильдии
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS lastBossAttackAt INTEGER DEFAULT 0;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS talentPoints INTEGER DEFAULT 0;

-- Личные таланты игрока в гильдии
CREATE TABLE IF NOT EXISTS player_guild_talents (
  userId INTEGER NOT NULL,
  guildId INTEGER NOT NULL,
  talentType TEXT NOT NULL CHECK (talentType IN ('accuracy','fortitude','penetration','control','vampiric')),
  level INTEGER DEFAULT 0,
  PRIMARY KEY (userId, guildId, talentType)
);

-- Гильдийские таланты (общие для всех членов)
CREATE TABLE IF NOT EXISTS guild_talents (
  guildId INTEGER NOT NULL REFERENCES guilds(id),
  talentType TEXT NOT NULL CHECK (talentType IN ('accuracy','fortitude','penetration','control','vampiric')),
  level INTEGER DEFAULT 0,
  PRIMARY KEY (guildId, talentType)
);

-- Очки гильдийских талантов
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS talentPoints INTEGER DEFAULT 0;
