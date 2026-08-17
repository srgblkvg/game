BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tournament_division INTEGER;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tournament_division_wins INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'playoff';

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS group_name TEXT;

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS series_index INTEGER NOT NULL DEFAULT 0;

UPDATE tournament_matches SET stage = 'playoff' WHERE stage IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tournament_participants
    GROUP BY tournamentid, userid
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate tournament participants must be resolved before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tournament_participants_tournament_user_uidx
  ON tournament_participants (tournamentid, userid);

GRANT SELECT, INSERT, UPDATE, DELETE ON users, tournaments, tournament_participants, tournament_matches TO game;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO game;

COMMIT;
