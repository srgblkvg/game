"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const yookassa_sdk_1 = require("yookassa-sdk");
const index_1 = require("../db/index");
const events_1 = require("../events");
const donate_1 = require("./donate");
const logger_1 = __importDefault(require("../logger"));
const email_1 = require("../email");
const env_1 = require("../env");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Инициализация таблицы платежей
index_1.db.run(`CREATE TABLE IF NOT EXISTS yukassa_payments (
  id SERIAL PRIMARY KEY,
  payment_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  item TEXT NOT NULL DEFAULT 'premium',
  days INTEGER NOT NULL DEFAULT 0,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)`).catch(() => { });
// Добавляем колонку item если её нет
index_1.db.run(`ALTER TABLE yukassa_payments ADD COLUMN IF NOT EXISTS item TEXT DEFAULT 'premium'`).catch(() => { });
const ITEMS = {
    premium_7d: { title: 'Премиум MMO Arena — 7 дней', price: 99, type: 'premium', days: 7 },
    premium_30d: { title: 'Премиум MMO Arena — 30 дней', price: 299, type: 'premium', days: 30 },
    starter_pack: { title: 'Стартовый набор', price: 99, type: 'starter_pack' },
    silver_10000: { title: '10000 серебра', price: 49, type: 'silver', silverAmount: 10000 },
    silver_50000: { title: '50000 серебра', price: 99, type: 'silver', silverAmount: 50000 },
    silver_100000: { title: '100000 серебра', price: 199, type: 'silver', silverAmount: 100000 },
    silver_500000: { title: '500000 серебра', price: 799, type: 'silver', silverAmount: 500000 },
    silver_1000000: { title: '1 000 000 серебра', price: 1399, type: 'silver', silverAmount: 1000000 },
    craft_rare: { title: 'Сундук «Редкий»', price: 99, type: 'craft_pack' },
    craft_epic: { title: 'Сундук «Эпический»', price: 199, type: 'craft_pack' },
    curse_small: { title: 'Сундук «Проклятый» (500k + 5 кристаллов)', price: 999, type: 'curse_pack' },
    curse_large: { title: 'Сундук «Проклятый II» (1M + 10 кристаллов)', price: 1799, type: 'curse_pack' },
    curse_x50: { title: 'Сундук «Проклятый III» (5M + 50 кристаллов)', price: 7999, type: 'curse_pack' },
    curse_x100: { title: 'Сундук «Проклятый IV» (10M + 100 кристаллов)', price: 14999, type: 'curse_pack' },
    ruby_rune_1: { title: 'Набор рун (Рубина+Топаз+Аметист) ×1', price: 399, type: 'rune_pack', runeCount: 1 },
    ruby_rune_3: { title: 'Набор рун (Рубина+Топаз+Аметист) ×3', price: 999, type: 'rune_pack', runeCount: 3 },
    ruby_rune_5: { title: 'Набор рун (Рубина+Топаз+Аметист) ×5', price: 1499, type: 'rune_pack', runeCount: 5 },
    mega_craft: { title: 'Мега набор ремесленника (7 рун + 7 материалов x200 + 20M)', price: 79999, type: 'mega_craft' },
    large_craft: { title: 'Большой набор ремесленника (7 рун + 7 материалов x100 + 10M)', price: 52999, type: 'mega_craft' },
    craft_rare_200: { title: 'Рунный набор ×200 (1000 сердцевин + 1200 булыжников + 2M)', price: 19999, type: 'mega_craft' },
};
// Старые тарифы (по дням) для обратной совместимости
const DAYS_ITEMS = {
    7: ITEMS['premium_7d'],
    30: ITEMS['premium_30d'],
};
let sdk = null;
function getSdk() {
    if (!sdk && env_1.YOOKASSA_SHOP_ID && env_1.YOOKASSA_SECRET_KEY) {
        sdk = (0, yookassa_sdk_1.YooKassa)({ shop_id: env_1.YOOKASSA_SHOP_ID, secret_key: env_1.YOOKASSA_SECRET_KEY, debug: false });
    }
    return sdk;
}
// POST /api/yukassa/create-payment — создание платежа (требует авторизации)
router.post('/create-payment', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const user = await index_1.db.one('SELECT email FROM users WHERE id = ?', [userId]);
        const customerEmail = user?.email || '';
        const yoo = getSdk();
        if (!yoo) {
            return res.status(500).json({ error: 'ЮKassa не настроена' });
        }
        // Новый формат: { item: 'starter_pack' } или { item: 'silver_1000' }
        const itemKey = req.body.item;
        // Старый формат: { days: 7 } или { days: 30 }
        const days = parseInt(req.body.days || '0', 10);
        let item;
        if (itemKey) {
            item = ITEMS[itemKey];
        }
        else if (days) {
            item = DAYS_ITEMS[days];
        }
        if (!item) {
            return res.status(400).json({ error: 'Некорректный товар' });
        }
        const now = Math.floor(Date.now() / 1000);
        const price = item.price.toFixed(2);
        const paymentData = {
            amount: { value: price, currency: yookassa_sdk_1.CurrencyEnum.RUB },
            confirmation: { type: 'redirect', return_url: 'https://mmoarena.ru/premium' },
            description: item.title,
            metadata: {
                userId: String(userId),
                item: itemKey || `premium_${days}d`,
                type: item.type,
                days: item.days || 0,
                silverAmount: item.silverAmount || 0,
                runeCount: item.runeCount || 0,
                amount: price,
                itemTitle: item.title,
            },
            capture: true,
        };
        if (customerEmail) {
            paymentData.receipt = {
                customer: { email: customerEmail },
                items: [{
                        description: item.title,
                        quantity: '1',
                        amount: { value: price, currency: yookassa_sdk_1.CurrencyEnum.RUB },
                        vat_code: 1, // без НДС
                    }],
            };
        }
        const payment = await yoo.payments.create(paymentData);
        await index_1.db.run(`INSERT INTO yukassa_payments (payment_id, user_id, item, days, amount, status, processed_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`, [payment.id, userId, itemKey || 'premium', item.days || 0, price, now]);
        const confirmationUrl = payment.confirmation && 'confirmation_url' in payment.confirmation
            ? payment.confirmation.confirmation_url
            : null;
        if (!confirmationUrl) {
            return res.status(500).json({ error: 'Не удалось получить ссылку для оплаты' });
        }
        res.json({ confirmation_url: confirmationUrl, payment_id: payment.id });
    }
    catch (err) {
        logger_1.default.error(`[YooKassa] create-payment error: ${err.message}`);
        res.status(500).json({ error: 'Ошибка создания платежа' });
    }
});
async function processDelivery(userId, itemType, days, silverAmount, itemKey, runeCount) {
    const now = Math.floor(Date.now() / 1000);
    if (itemType === 'premium' || (!itemType && days > 0)) {
        // Премиум
        const user = await index_1.db.one('SELECT premiumUntil FROM users WHERE id = ?', [userId]);
        if (!user)
            throw new Error('User not found');
        const currentUntil = Math.max(user.premiumUntil || 0, now);
        const newUntil = currentUntil + days * 86400;
        await index_1.db.run('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'yukassa', until: newUntil });
    }
    else if (itemType === 'starter_pack') {
        const result = await (0, donate_1.deliverStarterPack)(userId);
        if (!result.success)
            throw new Error(result.error || 'Delivery failed');
    }
    else if (itemType === 'silver') {
        const result = await (0, donate_1.deliverSilver)(userId, silverAmount);
        if (!result.success)
            throw new Error(result.error || 'Delivery failed');
    }
    else if (itemType === 'craft_pack') {
        const packType = itemKey === 'craft_rare' ? 'rare' : 'epic';
        const result = await (0, donate_1.deliverCraftPack)(userId, packType);
        if (!result.success)
            throw new Error(result.error || 'Delivery failed');
    }
    else if (itemType === 'curse_pack') {
        const packType = itemKey === 'curse_small' ? 'small' : itemKey === 'curse_large' ? 'large' : itemKey === 'curse_x50' ? 'x50' : 'x100';
        const result = await (0, donate_1.deliverCursePack)(userId, packType);
        if (!result.success)
            throw new Error(result.error || 'Delivery failed');
    }
    else if (itemType === 'rune_pack') {
        const result = await (0, donate_1.deliverRubyRune)(userId, runeCount || 1);
        if (!result.success)
            throw new Error(result.error || 'Delivery failed');
    }
    else if (itemType === 'mega_craft') {
        const result = itemKey === 'large_craft'
            ? await (0, donate_1.deliverLargeCraftSet)(userId)
            : itemKey === 'craft_rare_200'
                ? await (0, donate_1.deliverCraftRare200)(userId)
                : await (0, donate_1.deliverMegaCraftSet)(userId);
        if (!result.success)
            throw new Error(result.error || 'Delivery failed');
    }
}
// POST /api/yukassa/webhook — уведомления от ЮKassa
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        if (!body || body.type !== 'notification') {
            return res.status(400).json({ error: 'Invalid notification' });
        }
        const event = body.event;
        const paymentObj = body.object;
        if (!event || !paymentObj || !paymentObj.id) {
            return res.status(400).json({ error: 'Invalid notification payload' });
        }
        const paymentId = paymentObj.id;
        if (event === 'payment.succeeded') {
            const existing = await index_1.db.one('SELECT id, status, user_id, days FROM yukassa_payments WHERE payment_id = ?', [paymentId]);
            if (!existing) {
                logger_1.default.warn(`[YooKassa] Unknown payment ${paymentId}`);
                return res.json({ ok: true });
            }
            if (existing.status !== 'pending') {
                logger_1.default.info(`[YooKassa] Payment ${paymentId} already processed (${existing.status})`);
                return res.json({ ok: true });
            }
            // Проверяем платеж через API ЮKassa
            const yoo = getSdk();
            if (!yoo) {
                return res.status(500).json({ error: 'ЮKassa не настроена' });
            }
            const verified = await yoo.payments.load(paymentId);
            if (verified.status !== 'succeeded') {
                logger_1.default.warn(`[YooKassa] Payment ${paymentId} status mismatch: ${verified.status}`);
                return res.json({ ok: true });
            }
            const metadata = verified.metadata || {};
            const userId = parseInt(metadata.userId || String(existing.user_id) || '0', 10);
            const itemType = metadata.type || 'premium';
            const days = parseInt(metadata.days || String(existing.days) || '0', 10);
            const silverAmount = parseInt(metadata.silverAmount || '0', 10);
            const runeCount = parseInt(metadata.runeCount || '0', 10);
            if (!userId) {
                logger_1.default.error(`[YooKassa] Missing userId for payment ${paymentId}`);
                return res.json({ ok: true });
            }
            const now = Math.floor(Date.now() / 1000);
            try {
                await processDelivery(userId, itemType, days, silverAmount, metadata.item || '', runeCount);
            }
            catch (err) {
                logger_1.default.error(`[YooKassa] Delivery error for payment ${paymentId}: ${err.message}`);
                return res.status(500).json({ error: err.message });
            }
            await index_1.db.run('UPDATE yukassa_payments SET status = ?, processed_at = ? WHERE payment_id = ?', ['succeeded', now, paymentId]);
            logger_1.default.info(`[YooKassa] ${itemType} delivered to user ${userId} (payment ${paymentId})`);
            // Отправить чек на почту
            const itemTitle = metadata.itemTitle || ITEMS[metadata.item]?.title || itemType;
            index_1.db.one('SELECT email FROM users WHERE id = ?', [userId])
                .then((u) => { if (u?.email)
                (0, email_1.sendPaymentReceipt)(u.email, itemTitle, String(verified.amount?.value || '')); })
                .catch(() => { });
        }
        else if (event === 'payment.canceled') {
            const now = Math.floor(Date.now() / 1000);
            await index_1.db.run("UPDATE yukassa_payments SET status = 'canceled', processed_at = ? WHERE payment_id = ? AND status = 'pending'", [now, paymentId]);
        }
        res.json({ ok: true });
    }
    catch (err) {
        logger_1.default.error(`[YooKassa] webhook error: ${err.message}`);
        res.status(500).json({ error: 'Internal error' });
    }
});
// GET /api/yukassa/status/:paymentId — проверка статуса платежа
router.get('/status/:paymentId', auth_1.authMiddleware, async (req, res) => {
    try {
        const payment = await index_1.db.one('SELECT status FROM yukassa_payments WHERE payment_id = ? AND user_id = ?', [req.params.paymentId, req.userId]);
        if (!payment)
            return res.status(404).json({ error: 'Платёж не найден' });
        res.json({ status: payment.status });
    }
    catch (err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});
exports.default = router;
//# sourceMappingURL=yukassa.js.map