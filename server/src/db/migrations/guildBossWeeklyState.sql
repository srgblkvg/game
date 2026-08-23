BEGIN;

CREATE TABLE IF NOT EXISTS guild_boss_weekly_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  week_start INTEGER NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON guild_boss_weekly_state TO game;

COMMIT;
