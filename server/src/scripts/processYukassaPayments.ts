import { YooKassa } from 'yookassa-sdk';
import { db } from '../db/index';
import { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY } from '../env';

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

  const pending = await db.raw(
    "SELECT * FROM yukassa_payments WHERE status = 'pending' ORDER BY id",
  );

  if (pending.rows.length === 0) {
    console.log('No pending payments found');
    return;
  }

  console.log(`Found ${pending.rows.length} pending payment(s)`);

  for (const row of pending.rows) {
    console.log(`\nChecking payment ${row.payment_id}...`);
    try {
      const payment = await sdk.payments.load(row.payment_id);
      console.log(`  Status: ${payment.status}`);

      if (payment.status === 'succeeded') {
        const metadata = payment.metadata || {};
        const userId = parseInt(metadata.userId || String(row.user_id), 10);
        const days = parseInt(metadata.days || String(row.days), 10);

        const user = await db.one('SELECT premiumUntil FROM users WHERE id = ?', [userId]);
        if (!user) {
          console.log(`  User ${userId} not found, skipping`);
          await db.run(
            "UPDATE yukassa_payments SET status = 'failed' WHERE payment_id = ?",
            [row.payment_id],
          );
          continue;
        }

        const now = Math.floor(Date.now() / 1000);
        const currentUntil = Math.max(user.premiumUntil || 0, now);
        const newUntil = currentUntil + days * 86400;

        await db.run('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);
        await db.run(
          'UPDATE yukassa_payments SET status = ?, processed_at = ? WHERE payment_id = ?',
          ['succeeded', now, row.payment_id],
        );

        console.log(`  Premium ${days}d granted to user ${userId}, until ${new Date(newUntil * 1000).toISOString()}`);
      } else if (payment.status === 'canceled') {
        await db.run(
          "UPDATE yukassa_payments SET status = 'canceled' WHERE payment_id = ?",
          [row.payment_id],
        );
        console.log('  Payment was canceled, marked as such');
      } else {
        console.log(`  Payment status is "${payment.status}", not processing`);
      }
    } catch (err: any) {
      console.error(`  Error processing payment ${row.payment_id}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});