import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { sendToUser } from '../events';
import { authMiddleware } from '../middleware/auth';
import { deliverStarterPack, deliverSilver, deliverCraftPack } from './donate';
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
interface VkItem {
  title: string;
  price: number;
  type: 'premium' | 'starter_pack' | 'silver' | 'craft_pack';
  days?: number;
  amount?: number;
}

const ITEMS: Record<string, VkItem> = {
  premium_7d:   { title: 'Премиум MMO Arena — 7 дней',  price: 14, type: 'premium',       days: 7 },
  premium_30d:  { title: 'Премиум MMO Arena — 30 дней', price: 42, type: 'premium',       days: 30 },
  starter_pack: { title: 'Стартовый набор',              price: 14, type: 'starter_pack' },
  silver_1000:  { title: '1000 серебра',                 price: 7,  type: 'silver',        amount: 1000 },
  silver_5000:  { title: '5000 серебра',                 price: 14, type: 'silver',        amount: 5000 },
  silver_10000: { title: '10000 серебра',                price: 28, type: 'silver',        amount: 10000 },
  craft_rare:   { title: 'Сундук «Редкий»',              price: 14, type: 'craft_pack' },
  craft_epic:   { title: 'Сундук «Эпический»',           price: 28, type: 'craft_pack' },
};

// Проверка подписи запроса от VK
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
    const vkUserId = parseInt(params.user_id || '0', 10);
    const status = params.status || '';
    const item = ITEMS[itemName];

    logger.info(`[VK Payments] order status: ${status}, item: ${itemName}, user: ${vkUserId}, test: ${type === 'order_status_change_test'}`);

    if (!item) {
      return res.json({ error: { error_code: 20, error_msg: 'Item not found' } });
    }

    const now = Math.floor(Date.now() / 1000);

    if (status === 'chargeable') {
      try {
        // Ищем игрока по VK oauthId
        const character = await db.one(
          "SELECT id, premiumUntil FROM users WHERE oauthProvider = 'vk' AND oauthId = ?",
          [String(vkUserId)],
        );

        if (!character) {
          logger.warn(`[VK Payments] Character not found for VK user ${vkUserId}`);
          return res.json({ error: { error_code: 1, error_msg: 'Character not found' } });
        }

        let processed = false;

        if (item.type === 'premium') {
          // Продлеваем премиум
          const currentUntil = Math.max(character.premiumUntil || 0, now);
          const newUntil = currentUntil + (item.days || 0) * 86400;

          await db.run(
            'UPDATE users SET premiumUntil = ? WHERE id = ?',
            [newUntil, character.id],
          );

          sendToUser(character.id, { type: 'paymentStatus', status: 'success', platform: 'vk', until: newUntil });
          processed = true;
        } else if (item.type === 'starter_pack') {
          const result = await deliverStarterPack(character.id);
          if (!result.success) {
            return res.json({ error: { error_code: 1, error_msg: result.error || 'Delivery failed' } });
          }
          processed = true;
        } else if (item.type === 'silver') {
          const result = await deliverSilver(character.id, item.amount || 0);
          if (!result.success) {
            return res.json({ error: { error_code: 1, error_msg: result.error || 'Delivery failed' } });
          }
          processed = true;
        } else if (item.type === 'craft_pack') {
          const packType = itemName === 'craft_rare' ? 'rare' : 'epic';
          const result = await deliverCraftPack(character.id, packType);
          if (!result.success) {
            return res.json({ error: { error_code: 1, error_msg: result.error || 'Delivery failed' } });
          }
          processed = true;
        }

        if (processed) {
          // Логируем
          await db.run(
            `INSERT INTO vk_payments (order_id, user_id, character_id, item, status, processed_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [orderId, vkUserId, character.id as number, itemName, status, now],
          );

          logger.info(`[VK Payments] ${item.type} delivered to char ${character.id} (VK user ${vkUserId})`);
        }

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
        [orderId, vkUserId, itemName, status, now],
      );
    }

    return res.json({ response: { order_id: orderId, app_order_id: 0 } });
  }

  return res.json({ error: { error_code: 1, error_msg: 'Unknown notification type' } });
});

// GET /api/vk/payments/latest — последний статус платежа текущего юзера
router.get('/latest', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.one('SELECT id FROM users WHERE id = ?', [(req as any).userId]);
    if (!user) return res.json({ status: 'not_found' });

    const payment = await db.one(
      'SELECT status FROM vk_payments WHERE character_id = ? ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    res.json({ status: payment?.status || 'not_found' });
  } catch {
    res.json({ status: 'not_found' });
  }
});

export default router;
