import { YooKassa } from 'yookassa-sdk';
import { db } from '../db/index';
import { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY } from '../env';

interface PendingPaymentRow {
  payment_id: string;
  user_id: number;
  item: string;
  amount: string;
  status: string;
}

async function main() {
  if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
    console.error('YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY not set');
    process.exit(1);
  }

  const sdk = YooKassa({
    shop_id: YOOKASSA_SHOP_ID,
    secret_key: YOOKASSA_SECRET_KEY,
    debug: false,
  });

  // Read-only audit. Reward delivery is allowed only through the verified
  // webhook and its provider-specific atomic domain service.
  const pending = await db.raw(
    "SELECT payment_id, user_id, item, amount, status FROM yukassa_payments WHERE status = 'pending' ORDER BY id",
  );

  if (pending.rows.length === 0) {
    console.log('No pending payments found');
    return;
  }

  console.log(`Found ${pending.rows.length} pending payment(s); read-only audit`);

  for (const row of pending.rows as PendingPaymentRow[]) {
    try {
      const provider = await sdk.payments.load(row.payment_id);
      const metadata = provider.metadata || {};
      const providerUserId = String(metadata.userId || '');
      const providerItem = String(metadata.item || '');
      const identityMatches = providerUserId === String(row.user_id)
        && providerItem === String(row.item);

      console.log(JSON.stringify({
        paymentId: row.payment_id,
        localItem: row.item,
        localStatus: row.status,
        providerStatus: provider.status,
        identityMatches,
        action: provider.status === 'succeeded' && identityMatches
          ? 'retry-verified-webhook'
          : 'manual-review-no-delivery',
      }));
    } catch (error: any) {
      console.error(JSON.stringify({
        paymentId: row.payment_id,
        error: error?.message || String(error),
        action: 'manual-review-no-delivery',
      }));
    }
  }
}

main().catch((error) => {
  console.error('Fatal audit error:', error);
  process.exit(1);
});
