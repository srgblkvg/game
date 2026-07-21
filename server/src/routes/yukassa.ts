import { Router, Request, Response } from 'express';
import { YooKassa, CurrencyEnum } from 'yookassa-sdk';
import { db } from '../db/index';
import { sendToUser } from '../events';
import { deliverStarterPack, deliverSilver } from './donate';
import logger from '../logger';
import { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY } from '../env';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Инициализация таблицы платежей
db.run(`CREATE TABLE IF NOT EXISTS yukassa_payments (
  id SERIAL PRIMARY KEY,
  payment_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  item TEXT NOT NULL DEFAULT 'premium',
  days INTEGER NOT NULL DEFAULT 0,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)`).catch(() => {});

// Добавляем колонку item если её нет
db.run(`ALTER TABLE yukassa_payments ADD COLUMN IF NOT EXISTS item TEXT DEFAULT 'premium'`).catch(() => {});

// Товары
interface ShopItem {
  title: string;
  price: number;
  type: 'premium' | 'starter_pack' | 'silver';
  days?: number;
  silverAmount?: number;
}

const ITEMS: Record<string, ShopItem> = {
  premium_7d:   { title: 'Премиум MMO Arena — 7 дней',  price: 99,  type: 'premium',       days: 7 },
  premium_30d:  { title: 'Премиум MMO Arena — 30 дней', price: 299, type: 'premium',       days: 30 },
  starter_pack: { title: 'Стартовый набор',              price: 99,  type: 'starter_pack' },
  silver_1000:  { title: '1000 серебра',                 price: 49,  type: 'silver',        silverAmount: 1000 },
  silver_5000:  { title: '5000 серебра',                 price: 99,  type: 'silver',        silverAmount: 5000 },
  silver_10000: { title: '10000 серебра',                price: 199, type: 'silver',        silverAmount: 10000 },
};

// Старые тарифы (по дням) для обратной совместимости
const DAYS_ITEMS: Record<number, ShopItem> = {
  7:  ITEMS['premium_7d']!,
  30: ITEMS['premium_30d']!,
};

let sdk: ReturnType<typeof YooKassa> | null = null;
function getSdk() {
  if (!sdk && YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY) {
    sdk = YooKassa({ shop_id: YOOKASSA_SHOP_ID, secret_key: YOOKASSA_SECRET_KEY, debug: false });
  }
  return sdk;
}

// POST /api/yukassa/create-payment — создание платежа (требует авторизации)
router.post('/create-payment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const yoo = getSdk();
    if (!yoo) {
      return res.status(500).json({ error: 'ЮKassa не настроена' });
    }

    // Новый формат: { item: 'starter_pack' } или { item: 'silver_1000' }
    const itemKey = req.body.item as string | undefined;
    // Старый формат: { days: 7 } или { days: 30 }
    const days = parseInt(req.body.days || '0', 10);

    let item: ShopItem | undefined;

    if (itemKey) {
      item = ITEMS[itemKey];
    } else if (days) {
      item = DAYS_ITEMS[days];
    }

    if (!item) {
      return res.status(400).json({ error: 'Некорректный товар' });
    }

    const now = Math.floor(Date.now() / 1000);
    const price = item.price.toFixed(2);

    const payment = await yoo.payments.create({
      amount: { value: price, currency: CurrencyEnum.RUB },
      confirmation: { type: 'redirect', return_url: 'https://mmoarena.ru/premium' },
      description: item.title,
      metadata: {
        userId: String(userId),
        item: itemKey || `premium_${days}d`,
        type: item.type,
        days: item.days || 0,
        silverAmount: item.silverAmount || 0,
      },
      capture: true,
    });

    await db.run(
      `INSERT INTO yukassa_payments (payment_id, user_id, item, days, amount, status, processed_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [payment.id, userId, itemKey || 'premium', item.days || 0, price, now],
    );

    const confirmationUrl = payment.confirmation && 'confirmation_url' in payment.confirmation
      ? (payment.confirmation as { confirmation_url: string }).confirmation_url
      : null;

    if (!confirmationUrl) {
      return res.status(500).json({ error: 'Не удалось получить ссылку для оплаты' });
    }

    res.json({ confirmation_url: confirmationUrl, payment_id: payment.id });
  } catch (err: any) {
    logger.error(`[YooKassa] create-payment error: ${err.message}`);
    res.status(500).json({ error: 'Ошибка создания платежа' });
  }
});

async function processDelivery(userId: number, itemType: string, days: number, silverAmount: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (itemType === 'premium' || (!itemType && days > 0)) {
    // Премиум
    const user = await db.one('SELECT premiumUntil FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');
    const currentUntil = Math.max(user.premiumUntil || 0, now);
    const newUntil = currentUntil + days * 86400;
    await db.run('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);
    sendToUser(userId, { type: 'paymentStatus', status: 'success', platform: 'yukassa', until: newUntil });
  } else if (itemType === 'starter_pack') {
    const result = await deliverStarterPack(userId);
    if (!result.success) throw new Error(result.error || 'Delivery failed');
  } else if (itemType === 'silver') {
    const result = await deliverSilver(userId, silverAmount);
    if (!result.success) throw new Error(result.error || 'Delivery failed');
  }
}

// POST /api/yukassa/webhook — уведомления от ЮKassa
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any> | undefined;
    if (!body || body.type !== 'notification') {
      return res.status(400).json({ error: 'Invalid notification' });
    }

    const event = body.event as string | undefined;
    const paymentObj = body.object as Record<string, any> | undefined;

    if (!event || !paymentObj || !paymentObj.id) {
      return res.status(400).json({ error: 'Invalid notification payload' });
    }

    const paymentId = paymentObj.id as string;

    if (event === 'payment.succeeded') {
      const existing = await db.one(
        'SELECT id, status, user_id, days FROM yukassa_payments WHERE payment_id = ?',
        [paymentId],
      );

      if (!existing) {
        logger.warn(`[YooKassa] Unknown payment ${paymentId}`);
        return res.json({ ok: true });
      }

      if (existing.status !== 'pending') {
        logger.info(`[YooKassa] Payment ${paymentId} already processed (${existing.status})`);
        return res.json({ ok: true });
      }

      // Проверяем платеж через API ЮKassa
      const yoo = getSdk();
      if (!yoo) {
        return res.status(500).json({ error: 'ЮKassa не настроена' });
      }

      const verified = await yoo.payments.load(paymentId);
      if (verified.status !== 'succeeded') {
        logger.warn(`[YooKassa] Payment ${paymentId} status mismatch: ${verified.status}`);
        return res.json({ ok: true });
      }

      const metadata = verified.metadata || {};
      const userId = parseInt(metadata.userId || String(existing.user_id) || '0', 10);
      const itemType = metadata.type || 'premium';
      const days = parseInt(metadata.days || String(existing.days) || '0', 10);
      const silverAmount = parseInt(metadata.silverAmount || '0', 10);

      if (!userId) {
        logger.error(`[YooKassa] Missing userId for payment ${paymentId}`);
        return res.json({ ok: true });
      }

      const now = Math.floor(Date.now() / 1000);

      try {
        await processDelivery(userId, itemType, days, silverAmount);
      } catch (err: any) {
        logger.error(`[YooKassa] Delivery error for payment ${paymentId}: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }

      await db.run(
        'UPDATE yukassa_payments SET status = ?, processed_at = ? WHERE payment_id = ?',
        ['succeeded', now, paymentId],
      );

      logger.info(`[YooKassa] ${itemType} delivered to user ${userId} (payment ${paymentId})`);
    } else if (event === 'payment.canceled') {
      const now = Math.floor(Date.now() / 1000);
      await db.run(
        "UPDATE yukassa_payments SET status = 'canceled', processed_at = ? WHERE payment_id = ? AND status = 'pending'",
        [now, paymentId],
      );
    }

    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`[YooKassa] webhook error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/yukassa/status/:paymentId — проверка статуса платежа
router.get('/status/:paymentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const payment = await db.one(
      'SELECT status FROM yukassa_payments WHERE payment_id = ? AND user_id = ?',
      [req.params.paymentId, (req as any).userId]
    );
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
    res.json({ status: payment.status });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

export default router;
