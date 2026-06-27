import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import crypto from 'crypto';
import logger from '../logger';

const router = Router();

// Инициализация таблицы платежей
db.run(`CREATE TABLE IF NOT EXISTS vk_payments (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL DEFAULT 0,
  item TEXT NOT NULL,
  status TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)`).catch(() => {});

// Секретный ключ приложения VK (нужно задать в .env: VK_APP_SECRET)
const APP_SECRET = process.env.VK_APP_SECRET || '';

// Товары для VK Payments (цены в голосах: 1 голос ≈ 7₽)
const ITEMS: Record<string, { title: string; price: number; days: number }> = {
  premium_7d: { title: 'Премиум MMO Arena — 7 дней', price: 14, days: 7 },
  premium_30d: { title: 'Премиум MMO Arena — 30 дней', price: 42, days: 30 },
};

// Проверка подписи запроса от VK
// Алгоритм: MD5(concatenated sorted key=value pairs + secret_key)
// https://dev.vk.com/ru/api/payments/getting-started#Подпись
// https://pkg.go.dev/github.com/SevereCloud/vksdk/payments#Callback.Sign
function verifySignature(params: Record<string, string>): boolean {
  const sig = params.sig;
  if (!sig || !APP_SECRET) return false;
  const pairs = Object.entries(params)
    .filter(([k]) => k !== 'sig')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('');
  const computed = crypto.createHash('md5').update(pairs + APP_SECRET).digest('hex');
  return computed === sig;
}

// POST /api/vk/payments — колбэк от VK
router.post('/', async (req: Request, res: Response) => {
  const params = req.body as Record<string, string> | undefined;

  if (!params) {
    logger.warn('[VK Payments] Empty body');
    return res.json({ error: { error_code: 1, error_msg: 'Empty body' } });
  }

  // DEBUG: логируем сырой запрос для диагностики подписи
  logger.info(`[VK Payments RAW] body keys: ${Object.keys(params).sort().join(', ')}`);

  if (!verifySignature(params)) {
    logger.warn(`[VK Payments] Invalid signature. params: ${JSON.stringify(params)}`);
    return res.json({ error: { error_code: 1, error_msg: 'Invalid signature' } });
  }

  const type = params.notification_type || '';
  logger.info(`[VK Payments] notification: ${type} item=${params.item || '-'} user=${params.user_id || '-'}`);

  // get_item / get_item_test — VK запрашивает информацию о товаре
  if (type === 'get_item' || type === 'get_item_test') {
    const itemName = params.item || '';
    const item = ITEMS[itemName];

    if (!item) {
      return res.json({ error: { error_code: 20, error_msg: 'Item not found' } });
    }

    const title = type === 'get_item_test' ? item.title + ' (ТЕСТ)' : item.title;

    return res.json({
      response: {
        item_id: itemName,
        title,
        photo_url: 'https://mmoarena.ru/favicon.svg',
        price: item.price,
      },
    });
  }

  // order_status_change / order_status_change_test — уведомление о покупке
  if (type === 'order_status_change' || type === 'order_status_change_test') {
    const orderId = params.order_id || '';
    const itemName = params.item || '';
    const userId = parseInt(params.user_id || '0', 10);
    const status = params.status || '';
    const item = ITEMS[itemName];

    logger.info(`[VK Payments] order status: ${status}, item: ${itemName}, user: ${userId}, test: ${type === 'order_status_change_test'}`);

    if (!item) {
      return res.json({ error: { error_code: 20, error_msg: 'Item not found' } });
    }

    const now = Math.floor(Date.now() / 1000);

    if (status === 'chargeable') {
      try {
        // Ищем игрока по VK oauthId
        const character = await db.one(
          "SELECT id, premiumUntil FROM users WHERE oauthProvider = 'vk' AND oauthId = ?",
          [String(userId)],
        );

        if (!character) {
          logger.warn(`[VK Payments] Character not found for VK user ${userId}`);
          return res.json({ error: { error_code: 1, error_msg: 'Character not found' } });
        }

        // Продлеваем премиум
        const currentUntil = Math.max(character.premiumUntil || 0, now);
        const newUntil = currentUntil + item.days * 86400;

        await db.run(
          'UPDATE users SET premiumUntil = ? WHERE id = ?',
          [newUntil, character.id],
        );

        // Логируем
        await db.run(
          `INSERT INTO vk_payments (order_id, user_id, character_id, item, status, processed_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, userId, character.id as number, itemName, status, now],
        );

        logger.info(`[VK Payments] Premium ${item.days}d granted to char ${character.id} (VK user ${userId})`);

        return res.json({ response: { order_id: orderId, app_order_id: 0 } });
      } catch (err: any) {
        logger.error(`[VK Payments] Error: ${err.message}`);
        return res.json({ error: { error_code: 1, error_msg: err.message } });
      }
    }

    // refunded или повторное уведомление
    if (status === 'refunded') {
      await db.run(
        `INSERT INTO vk_payments (order_id, user_id, character_id, item, status, processed_at)
         VALUES (?, ?, 0, ?, ?, ?)`,
        [orderId, userId, itemName, status, now],
      );
    }

    return res.json({ response: { order_id: orderId, app_order_id: 0 } });
  }

  return res.json({ error: { error_code: 1, error_msg: 'Unknown notification type' } });
});

export default router;
