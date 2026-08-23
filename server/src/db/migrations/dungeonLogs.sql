BEGIN;

CREATE TABLE IF NOT EXISTS dungeon_logs (
  id SERIAL PRIMARY KEY,
  userId INTEGER,
  floor INTEGER,
  playerHp INTEGER,
  playerMaxHp INTEGER,
  playerStr INTEGER,
  playerAgi INTEGER,
  playerDef INTEGER,
  playerMag INTEGER,
  enemies JSONB,
  startedAt INTEGER,
  endedAt INTEGER,
  result TEXT,
  combatLog JSONB
);

GRANT SELECT, INSERT, UPDATE, DELETE ON dungeon_logs TO game;
GRANT USAGE, SELECT ON SEQUENCE dungeon_logs_id_seq TO game;

COMMIT;
