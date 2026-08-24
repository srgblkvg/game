import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { sendToUser } from '../events';
import { authMiddleware } from '../middleware/auth';

import crypto from 'crypto';
import logger from '../logger';
import { processVkSilverPayment } from '../game/vkPaymentDelivery';
import { createPgVkPaymentDeliveryRepository, ensureVkPaymentDeliveryReady } from '../game/vkPaymentDeliveryRepository';
import { processVkCraftPackPayment } from '../game/vkCraftPackPayment';
import { createPgVkCraftPackRepository } from '../game/vkCraftPackPaymentRepository';
import { processVkRunePackPayment } from '../game/vkRunePackPayment';
import { processVkCursePackPayment } from '../game/vkCursePackPayment';
import { processVkMegaPackPayment } from '../game/vkMegaPackPayment';
import { processVkPremiumPayment } from '../game/vkPremiumPayment';
import { createPgVkPremiumRepository } from '../game/vkPremiumPaymentRepository';
import { processVkStarterPackPayment } from '../game/vkStarterPackPayment';
import { createPgVkStarterPackRepository } from '../game/vkStarterPackPaymentRepository';

const router = Router();

export const vkPaymentsReady = ensureVkPaymentDeliveryReady();

// Секретный ключ приложения VK (нужно задать в .env: VK_APP_SECRET)
const APP_SECRET = process.env.VK_APP_SECRET || '';

// Товары для VK Payments (цены в голосах: 1 голос ≈ 7₽)
interface VkItem {
  title: string;
  price: number;
  type: 'premium' | 'starter_pack' | 'silver' | 'craft_pack' | 'curse_pack' | 'rune_pack' | 'mega_craft';
  days?: number;
  amount?: number;
  count?: number;
}

const ITEMS: Record<string, VkItem> = {
  premium_7d:    { title: 'Премиум MMO Arena — 7 дней',  price: 14,  type: 'premium',       days: 7 },
  premium_30d:   { title: 'Премиум MMO Arena — 30 дней', price: 42,  type: 'premium',       days: 30 },
  starter_pack:  { title: 'Стартовый набор',              price: 14,  type: 'starter_pack' },
  silver_10000:  { title: '10000 серебра',                price: 7,   type: 'silver',        amount: 10000 },
  silver_50000:  { title: '50000 серебра',                price: 14,  type: 'silver',        amount: 50000 },
  silver_100000: { title: '100000 серебра',               price: 28,  type: 'silver',        amount: 100000 },
  silver_500000: { title: '500000 серебра',               price: 114, type: 'silver',        amount: 500000 },
  silver_1000000:{ title: '1 000 000 серебра',            price: 200, type: 'silver',        amount: 1000000 },
  craft_rare:    { title: 'Сундук «Редкий»',              price: 14,  type: 'craft_pack' },
  craft_epic:    { title: 'Сундук «Эпический»',           price: 28,  type: 'craft_pack' },
  curse_small:   { title: 'Сундук «Проклятый» (500k + 5 кристаллов)', price: 144, type: 'curse_pack' },
  curse_large:   { title: 'Сундук «Проклятый II» (1M + 10 кристаллов)', price: 258, type: 'curse_pack' },
  curse_x50:     { title: 'Сундук «Проклятый III» (5M + 50 кристаллов)', price: 1149, type: 'curse_pack' },
  curse_x100:    { title: 'Сундук «Проклятый IV» (10M + 100 кристаллов)', price: 2149, type: 'curse_pack' },
  ruby_rune_1:   { title: 'Набор рун (Рубина+Топаз+Аметист) ×1', price: 57,  type: 'rune_pack', count: 1 },
  ruby_rune_3:   { title: 'Набор рун (Рубина+Топаз+Аметист) ×3', price: 144, type: 'rune_pack', count: 3 },
  ruby_rune_5:   { title: 'Набор рун (Рубина+Топаз+Аметист) ×5', price: 214, type: 'rune_pack', count: 5 },
  mega_craft:    { title: 'Мега набор ремесленника (7 рун + 7 материалов x200 + 20M)', price: 11000, type: 'mega_craft' },
  large_craft:   { title: 'Большой набор ремесленника (7 рун + 7 материалов x100 + 10M)', price: 7500, type: 'mega_craft' },
  craft_rare_200:{ title: 'Рунный набор ×200 (1000 сердцевин + 1200 булыжников + 2M)', price: 2800, type: 'mega_craft' },
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
    await vkPaymentsReady;

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
          const result = await processVkPremiumPayment(createPgVkPremiumRepository(), {
            orderId, vkUserId, item: itemName,
            providerPrice: Number(params.item_price), processedAt: now,
          });
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk', until: result.premiumUntil });
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
        } else if (item.type === 'starter_pack') {
          const result = await processVkStarterPackPayment(createPgVkStarterPackRepository(), {
            orderId, vkUserId, item: itemName,
            providerPrice: Number(params.item_price), processedAt: now,
          }, () => crypto.randomUUID());
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk', until: result.premiumUntil });
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
        } else if (item.type === 'silver') {
          const result = await processVkSilverPayment(createPgVkPaymentDeliveryRepository(), {
            orderId,
            vkUserId,
            item: itemName,
            providerPrice: Number(params.item_price),
            processedAt: now,
          });
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk' });
            logger.info(`[VK Payments] silver delivered to char ${result.characterId} (VK user ${vkUserId})`);
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
        } else if (item.type === 'craft_pack') {
          const result = await processVkCraftPackPayment(createPgVkCraftPackRepository(), {
            orderId, vkUserId, item: itemName,
            providerPrice: Number(params.item_price), processedAt: now,
          });
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk' });
            logger.info(`[VK Payments] craft pack delivered to char ${result.characterId} (VK user ${vkUserId})`);
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
        } else if (item.type === 'curse_pack') {
          const result = await processVkCursePackPayment(createPgVkCraftPackRepository(), {
            orderId, vkUserId, item: itemName,
            providerPrice: Number(params.item_price), processedAt: now,
          });
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk' });
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
        } else if (item.type === 'rune_pack') {
          const result = await processVkRunePackPayment(createPgVkCraftPackRepository(), {
            orderId, vkUserId, item: itemName,
            providerPrice: Number(params.item_price), processedAt: now,
          });
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk' });
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
        } else if (item.type === 'mega_craft') {
          const result = await processVkMegaPackPayment(createPgVkCraftPackRepository(), {
            orderId, vkUserId, item: itemName,
            providerPrice: Number(params.item_price), processedAt: now,
          });
          if (result.status === 'rejected') {
            return res.json({ error: { error_code: 1, error_msg: result.reason } });
          }
          if (result.status === 'delivered') {
            sendToUser(result.characterId, { type: 'paymentStatus', status: 'success', platform: 'vk' });
          }
          return res.json({ response: { order_id: orderId, app_order_id: 0 } });
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
