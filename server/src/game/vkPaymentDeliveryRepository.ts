import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { VkDeliveryClaimInput, VkPaymentDeliveryRepository, VkPaymentDeliveryTransaction } from './vkPaymentDelivery';

let readiness: Promise<void> | null = null;
export function ensureVkPaymentDeliveryReady(): Promise<void> {
  if (!readiness) readiness = db.tx(async client => {
  await client.query(`CREATE TABLE IF NOT EXISTS payment_deliveries (
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
  )`);
  const conflict = (await client.query(`SELECT order_id FROM vk_payments
    WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
    HAVING COUNT(DISTINCT user_id) > 1 OR COUNT(DISTINCT item) > 1
      OR COUNT(DISTINCT NULLIF(character_id, 0)) > 1
      OR BOOL_OR(character_id IS NULL OR character_id <= 0) LIMIT 1`)).rows[0];
  if (conflict) throw new Error('conflicting historical VK payment identities: ' + conflict.order_id);
  await client.query(`INSERT INTO payment_deliveries
    (provider, external_id, provider_user_id, character_id, item, status, processed_at)
    SELECT 'vk', order_id, MAX(user_id), NULLIF(MAX(character_id), 0), MAX(item), 'succeeded', MAX(processed_at)
    FROM vk_payments WHERE status = 'chargeable' AND order_id <> '' GROUP BY order_id
    ON CONFLICT (provider, external_id) DO NOTHING`);
  });
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
