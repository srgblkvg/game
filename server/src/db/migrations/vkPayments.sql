BEGIN;

CREATE TABLE IF NOT EXISTS vk_payments (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL DEFAULT 0,
  item TEXT NOT NULL,
  status TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_deliveries (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  character_id INTEGER,
  item TEXT NOT NULL,
  status TEXT NOT NULL,
  processed_at BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM vk_payments
    WHERE status = 'chargeable' AND order_id <> ''
    GROUP BY order_id
    HAVING COUNT(DISTINCT user_id) > 1
       OR COUNT(DISTINCT item) > 1
       OR COUNT(DISTINCT NULLIF(character_id, 0)) > 1
       OR BOOL_OR(character_id IS NULL OR character_id <= 0)
  ) THEN
    RAISE EXCEPTION 'conflicting historical VK payment identities';
  END IF;
END $$;

INSERT INTO payment_deliveries
  (provider, external_id, provider_user_id, character_id, item, status, processed_at)
SELECT
  'vk', order_id, MAX(user_id), NULLIF(MAX(character_id), 0),
  MAX(item), 'succeeded', MAX(processed_at)
FROM vk_payments
WHERE status = 'chargeable' AND order_id <> ''
GROUP BY order_id
ON CONFLICT (provider, external_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_deliveries pd
    JOIN (
      SELECT order_id, MAX(user_id)::bigint AS user_id,
        NULLIF(MAX(character_id), 0) AS character_id, MAX(item) AS item
      FROM vk_payments
      WHERE status = 'chargeable' AND order_id <> ''
      GROUP BY order_id
    ) vp ON pd.provider = 'vk' AND pd.external_id = vp.order_id
    WHERE pd.provider_user_id <> vp.user_id
       OR pd.character_id IS DISTINCT FROM vp.character_id
       OR pd.item <> vp.item
  ) THEN
    RAISE EXCEPTION 'conflicting VK payment delivery identities';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payment_deliveries pd
    JOIN (
      SELECT order_id, MAX(processed_at)::bigint AS processed_at
      FROM vk_payments
      WHERE status = 'chargeable' AND order_id <> ''
      GROUP BY order_id
    ) vp ON pd.provider = 'vk' AND pd.external_id = vp.order_id
    WHERE pd.status <> 'succeeded'
       OR pd.processed_at IS DISTINCT FROM vp.processed_at
  ) THEN
    RAISE EXCEPTION 'conflicting VK payment delivery terminal state';
  END IF;
END $$;

GRANT SELECT, INSERT ON vk_payments TO game;
GRANT SELECT, INSERT, UPDATE ON payment_deliveries TO game;
GRANT USAGE, SELECT ON SEQUENCE vk_payments_id_seq TO game;
GRANT USAGE, SELECT ON SEQUENCE payment_deliveries_id_seq TO game;

COMMIT;
