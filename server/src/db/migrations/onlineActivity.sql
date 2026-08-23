BEGIN;

CREATE TABLE IF NOT EXISTS game_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  browser_session_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  started_at BIGINT NOT NULL,
  last_heartbeat_at BIGINT NOT NULL,
  ended_at BIGINT,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT,
  UNIQUE (user_id, browser_session_id)
);

CREATE TABLE IF NOT EXISTS game_page_visits (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  started_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL,
  ended_at BIGINT,
  active_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_started ON game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_last_heartbeat ON game_sessions(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_game_page_visits_started ON game_page_visits(started_at);
CREATE INDEX IF NOT EXISTS idx_game_page_visits_path ON game_page_visits(path);

GRANT SELECT, INSERT, UPDATE, DELETE ON game_sessions, game_page_visits TO game;
GRANT USAGE, SELECT ON SEQUENCE game_sessions_id_seq, game_page_visits_id_seq TO game;

COMMIT;
