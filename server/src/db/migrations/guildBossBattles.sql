-- История боёв с гильд-боссом
CREATE TABLE IF NOT EXISTS guild_boss_battles (
  id SERIAL PRIMARY KEY,
  guildId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  damageDealt INTEGER NOT NULL DEFAULT 0,
  bossHpBefore INTEGER NOT NULL DEFAULT 0,
  bossHpAfter INTEGER NOT NULL DEFAULT 0,
  playerWon BOOLEAN DEFAULT false,
  bossKilled BOOLEAN DEFAULT false,
  steps TEXT NOT NULL DEFAULT '[]',
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gbb_guild ON guild_boss_battles(guildId);
CREATE INDEX IF NOT EXISTS idx_gbb_user ON guild_boss_battles(userId);
