BEGIN;

CREATE TABLE IF NOT EXISTS yukassa_payments (
  id SERIAL PRIMARY KEY,
  payment_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  days INTEGER NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  item TEXT DEFAULT 'premium'
);

CREATE UNIQUE INDEX IF NOT EXISTS yukassa_payments_payment_id_uidx
  ON yukassa_payments (payment_id);

GRANT SELECT, INSERT, UPDATE ON yukassa_payments TO game;
GRANT USAGE, SELECT ON SEQUENCE yukassa_payments_id_seq TO game;

COMMIT;
