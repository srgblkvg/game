import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { VkDeliveryClaimInput, VkPaymentDeliveryRepository, VkPaymentDeliveryTransaction } from './vkPaymentDelivery';

let readiness: Promise<void> | null = null;
export function ensureVkPaymentDeliveryReady(): Promise<void> {
  if (!readiness) readiness = (async () => {
    const schema = await db.raw(`
      SELECT
        (
          SELECT jsonb_agg(
            jsonb_build_array(column_name, data_type, is_nullable, COALESCE(column_default, ''))
            ORDER BY ordinal_position
          )
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vk_payments'
        ) = '[
          ["id", "integer", "NO", "nextval(''vk_payments_id_seq''::regclass)"],
          ["order_id", "text", "NO", ""],
          ["user_id", "integer", "NO", ""],
          ["character_id", "integer", "NO", "0"],
          ["item", "text", "NO", ""],
          ["status", "text", "NO", ""],
          ["processed_at", "integer", "NO", ""],
          ["created_at", "timestamp without time zone", "YES", "now()"]
        ]'::jsonb
        AND EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('vk_payments')
            AND contype = 'p' AND convalidated = true
            AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
        )
        AND has_table_privilege(current_user, 'vk_payments', 'SELECT')
        AND has_table_privilege(current_user, 'vk_payments', 'INSERT')
        AND to_regclass('vk_payments_id_seq') IS NOT NULL
        AND has_sequence_privilege(current_user, to_regclass('vk_payments_id_seq'), 'USAGE')
        AS vk_ready,
        (
          SELECT jsonb_agg(
            jsonb_build_array(column_name, data_type, is_nullable, COALESCE(column_default, ''))
            ORDER BY ordinal_position
          )
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payment_deliveries'
        ) = '[
          ["id", "bigint", "NO", "nextval(''payment_deliveries_id_seq''::regclass)"],
          ["provider", "text", "NO", ""],
          ["external_id", "text", "NO", ""],
          ["provider_user_id", "bigint", "NO", ""],
          ["character_id", "integer", "YES", ""],
          ["item", "text", "NO", ""],
          ["status", "text", "NO", ""],
          ["processed_at", "bigint", "YES", ""],
          ["created_at", "timestamp without time zone", "YES", "now()"]
        ]'::jsonb
        AND EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('payment_deliveries')
            AND contype = 'p' AND convalidated = true
            AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('payment_deliveries')
            AND contype = 'u' AND convalidated = true
            AND pg_get_constraintdef(oid) = 'UNIQUE (provider, external_id)'
        )
        AND has_table_privilege(current_user, 'payment_deliveries', 'SELECT')
        AND has_table_privilege(current_user, 'payment_deliveries', 'INSERT')
        AND has_table_privilege(current_user, 'payment_deliveries', 'UPDATE')
        AND to_regclass('payment_deliveries_id_seq') IS NOT NULL
        AND has_sequence_privilege(current_user, to_regclass('payment_deliveries_id_seq'), 'USAGE')
        AS ledger_ready
    `);
    if (schema.rows[0]?.vk_ready !== true) {
      throw new Error('vk_payments schema readiness failed');
    }
    if (schema.rows[0]?.ledger_ready !== true) {
      throw new Error('payment_deliveries schema readiness failed');
    }

    const conflict = (await db.raw(`SELECT order_id FROM vk_payments
      WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
      HAVING COUNT(DISTINCT user_id) > 1 OR COUNT(DISTINCT item) > 1
        OR COUNT(DISTINCT NULLIF(character_id, 0)) > 1
        OR BOOL_OR(character_id IS NULL OR character_id <= 0) LIMIT 1`)).rows[0];
    if (conflict) throw new Error('conflicting historical VK payment identities: ' + conflict.order_id);

    const missing = (await db.raw(`SELECT vp.order_id
      FROM (SELECT DISTINCT order_id FROM vk_payments
        WHERE status = 'chargeable' AND order_id <> '') vp
      LEFT JOIN payment_deliveries pd
        ON pd.provider = 'vk' AND pd.external_id = vp.order_id
      WHERE pd.id IS NULL LIMIT 1`)).rows[0];
    if (missing) throw new Error('missing historical VK payment deliveries: ' + missing.order_id);

    const ledgerConflict = (await db.raw(`SELECT pd.external_id
      FROM payment_deliveries pd
      JOIN (
        SELECT order_id, MAX(user_id)::bigint AS user_id,
          NULLIF(MAX(character_id), 0) AS character_id, MAX(item) AS item
        FROM vk_payments WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
      ) vp ON pd.provider = 'vk' AND pd.external_id = vp.order_id
      WHERE pd.provider_user_id <> vp.user_id
        OR pd.character_id IS DISTINCT FROM vp.character_id
        OR pd.item <> vp.item LIMIT 1`)).rows[0];
    if (ledgerConflict) {
      throw new Error('conflicting VK payment delivery identities: ' + ledgerConflict.external_id);
    }

    const terminalConflict = (await db.raw(`SELECT pd.external_id
      FROM payment_deliveries pd
      JOIN (
        SELECT order_id, MAX(processed_at)::bigint AS processed_at
        FROM vk_payments WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
      ) vp ON pd.provider = 'vk' AND pd.external_id = vp.order_id
      WHERE pd.status <> 'succeeded'
        OR pd.processed_at IS DISTINCT FROM vp.processed_at LIMIT 1`)).rows[0];
    if (terminalConflict) {
      throw new Error('conflicting VK payment delivery terminal state: ' + terminalConflict.external_id);
    }

  })();
  return readiness;
}

function adapter(client: PoolClient): VkPaymentDeliveryTransaction {
  return {
    async claim(input: VkDeliveryClaimInput) {
      await client.query(`INSERT INTO payment_deliveries
        (provider, external_id, provider_user_id, item, status)
        VALUES ($1, $2, $3, $4, 'pending')
        ON CONFLICT (provider, external_id) DO NOTHING`,
      [input.provider, input.externalId, input.providerUserId, input.item]);
      const row = (await client.query(`SELECT provider, external_id, provider_user_id, item, status, processed_at
        FROM payment_deliveries WHERE provider = $1 AND external_id = $2 FOR UPDATE`,
      [input.provider, input.externalId])).rows[0];
      if (!row) throw new Error('payment delivery claim failed');
      return {
        provider: 'vk', externalId: row.external_id,
        providerUserId: Number(row.provider_user_id), item: row.item,
        status: row.status,
        ...(row.processed_at === null ? {} : { processedAt: Number(row.processed_at) }),
      };
    },
    async lockVkUser(vkUserId) {
      const row = (await client.query(`SELECT id, bank FROM users
        WHERE oauthprovider = 'vk' AND oauthid = $1 FOR UPDATE`, [String(vkUserId)])).rows[0];
      return row ? { id: Number(row.id), bank: row.bank === null ? null : Number(row.bank) } : null;
    },
    async addBank(characterId, amount) {
      await client.query('UPDATE users SET bank = COALESCE(bank, 0) + $1 WHERE id = $2', [amount, characterId]);
    },
    async logPayment(input) {
      await client.query(`INSERT INTO vk_payments
        (order_id, user_id, character_id, item, status, processed_at)
        VALUES ($1, $2, $3, $4, 'chargeable', $5)`,
      [input.orderId, input.vkUserId, input.characterId, input.item, input.processedAt]);
    },
    async markSucceeded(orderId, processedAt, characterId) {
      const result = await client.query(`UPDATE payment_deliveries
        SET status = 'succeeded', processed_at = $1, character_id = $2
        WHERE provider = 'vk' AND external_id = $3 AND status = 'pending'`,
      [processedAt, characterId ?? null, orderId]);
      if (result.rowCount !== 1) throw new Error('payment delivery status update failed');
    },
  };
}

export function createPgVkPaymentDeliveryRepository(): VkPaymentDeliveryRepository {
  return { transaction: callback => db.tx(client => callback(adapter(client))) };
}
