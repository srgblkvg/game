import { Router, Request, Response } from 'express';
import { YooKassa, CurrencyEnum } from 'yookassa-sdk';
import { db } from '../db/index';
import { sendToUser } from '../events';
import logger from '../logger';
import { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY } from '../env';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Инициализация таблицы платежей
db.run(`CREATE TABLE IF NOT EXISTS yukassa_payments (
  id SERIAL PRIMARY KEY,
  payment_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  days INTEGER NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)`).catch(() => {});

const ITEMS: Record<number, { title: string; price: number }> = {
  7: { title: 'Премиум MMO Arena — 7 дней', price: 99 },
  30: { title: 'Премиум MMO Arena — 30 дней', price: 299 },
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

    const days = parseInt(req.body.days || '0', 10);
    const item = ITEMS[days];
    if (!item) {
      return res.status(400).json({ error: 'Некорректный тариф' });
    }

    const now = Math.floor(Date.now() / 1000);
    const amount = item.price.toFixed(2);

    const payment = await yoo.payments.create({
      amount: { value: amount, currency: CurrencyEnum.RUB },
      confirmation: { type: 'redirect', return_url: 'https://mmoarena.ru/premium' },
      description: item.title,
      metadata: { userId: String(userId), days: String(days) },
      capture: true,
    });

    await db.run(
      `INSERT INTO yukassa_payments (payment_id, user_id, days, amount, status, processed_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [payment.id, userId, days, amount, now],
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
        'SELECT id, status FROM yukassa_payments WHERE payment_id = ?',
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
      const userId = parseInt(metadata.userId || '0', 10);
      const days = parseInt(metadata.days || '0', 10);

      if (!userId || !days) {
        logger.error(`[YooKassa] Missing metadata for payment ${paymentId}`);
        return res.json({ ok: true });
      }

      const now = Math.floor(Date.now() / 1000);

      // Получаем текущий premiumUntil, продлеваем
      const user = await db.one('SELECT premiumUntil FROM users WHERE id = ?', [userId]);
      if (!user) {
        logger.warn(`[YooKassa] User ${userId} not found for payment ${paymentId}`);
        return res.json({ ok: true });
      }

      const currentUntil = Math.max(user.premiumUntil || 0, now);
      const newUntil = currentUntil + days * 86400;

      await db.run('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);

      // Уведомляем через WS
      sendToUser(userId, { type: 'premiumActivated', until: newUntil });

      await db.run(
        'UPDATE yukassa_payments SET status = ?, processed_at = ? WHERE payment_id = ?',
        ['succeeded', now, paymentId],
      );

      logger.info(`[YooKassa] Premium ${days}d granted to user ${userId} (payment ${paymentId})`);
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