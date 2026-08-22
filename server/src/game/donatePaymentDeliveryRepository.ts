import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type {
  DonatePaymentDeliveryRepository,
  DonatePaymentDeliveryTransaction,
  LockedYooKassaPayment,
} from './donatePaymentDelivery';

function payment(row: any): LockedYooKassaPayment {
  return {
    paymentId: String(row.payment_id),
    userId: Number(row.user_id),
    item: String(row.item),
    amount: String(row.amount),
    status: String(row.status),
    processedAt: Number(row.processed_at),
  };
}

function adapter(client: PoolClient, failMarkSucceeded: boolean): DonatePaymentDeliveryTransaction {
  return {
    async lockPayment(paymentId) {
      const row = (await client.query(
        `SELECT payment_id, user_id, item, amount, status, processed_at
         FROM yukassa_payments WHERE payment_id = $1 FOR UPDATE`,
        [paymentId],
      )).rows[0];
      return row ? payment(row) : null;
    },
    async lockUser(userId) {
      const row = (await client.query(
        'SELECT id, bank FROM users WHERE id = $1 FOR UPDATE', [userId],
      )).rows[0];
      return row ? { id: Number(row.id), bank: row.bank === null ? null : Number(row.bank) } : null;
    },
    async addBank(userId, amount) {
      await client.query('UPDATE users SET bank = COALESCE(bank, 0) + $1 WHERE id = $2', [amount, userId]);
    },
    async markSucceeded(paymentId, processedAt) {
      if (failMarkSucceeded) throw new Error('forced mark succeeded failure');
      const result = await client.query(
        `UPDATE yukassa_payments SET status = 'succeeded', processed_at = $1
         WHERE payment_id = $2 AND status = 'pending'`,
        [processedAt, paymentId],
      );
      if (result.rowCount !== 1) throw new Error('payment status update failed');
    },
  };
}

export function createPgDonatePaymentDeliveryRepository(
  options: { failMarkSucceeded?: boolean } = {},
): DonatePaymentDeliveryRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client, options.failMarkSucceeded === true)));
    },
  };
}
