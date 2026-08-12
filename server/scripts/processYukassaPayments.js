"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yookassa_sdk_1 = require("yookassa-sdk");
const index_1 = require("../db/index");
const env_1 = require("../env");
async function main() {
    if (!env_1.YOOKASSA_SHOP_ID || !env_1.YOOKASSA_SECRET_KEY) {
        console.error('YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY not set');
        process.exit(1);
    }
    const sdk = (0, yookassa_sdk_1.YooKassa)({
        shop_id: env_1.YOOKASSA_SHOP_ID,
        secret_key: env_1.YOOKASSA_SECRET_KEY,
        debug: false,
    });
    const pending = await index_1.db.raw("SELECT * FROM yukassa_payments WHERE status = 'pending' ORDER BY id");
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
                const user = await index_1.db.one('SELECT premiumUntil FROM users WHERE id = ?', [userId]);
                if (!user) {
                    console.log(`  User ${userId} not found, skipping`);
                    await index_1.db.run("UPDATE yukassa_payments SET status = 'failed' WHERE payment_id = ?", [row.payment_id]);
                    continue;
                }
                const now = Math.floor(Date.now() / 1000);
                const currentUntil = Math.max(user.premiumUntil || 0, now);
                const newUntil = currentUntil + days * 86400;
                await index_1.db.run('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);
                await index_1.db.run('UPDATE yukassa_payments SET status = ?, processed_at = ? WHERE payment_id = ?', ['succeeded', now, row.payment_id]);
                console.log(`  Premium ${days}d granted to user ${userId}, until ${new Date(newUntil * 1000).toISOString()}`);
            }
            else if (payment.status === 'canceled') {
                await index_1.db.run("UPDATE yukassa_payments SET status = 'canceled' WHERE payment_id = ?", [row.payment_id]);
                console.log('  Payment was canceled, marked as such');
            }
            else {
                console.log(`  Payment status is "${payment.status}", not processing`);
            }
        }
        catch (err) {
            console.error(`  Error processing payment ${row.payment_id}: ${err.message}`);
        }
    }
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=processYukassaPayments.js.map