import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { authMiddleware } from '../middleware/auth';
import { sendToUser } from '../events';
import logger from '../logger';

const router = Router();

// DDL: флаг покупки стартового набора
db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS starter_pack_purchased BOOLEAN DEFAULT false`).catch(() => {});

// Все слоты экипировки
const ALL_SLOTS = ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt'];

// Выдать стартовый набор игроку (вызывается из payment-колбэков)
export async function deliverStarterPack(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.one(
      'SELECT id, starter_pack_purchased, premiumUntil, inventory, money FROM users WHERE id = ?',
      [userId]
    ) as any;

    if (!user) return { success: false, error: 'Пользователь не найден' };
    if (user.starter_pack_purchased) return { success: false, error: 'Стартовый набор уже получен' };

    const now = Math.floor(Date.now() / 1000);

    // 1. Собираем фулл сет обычных предметов (rarity_id=1, по одному на слот)
    const packItems: any[] = [];
    for (const slot of ALL_SLOTS) {
      const item = await db.one(
        'SELECT id, name, slot, rarity_id, bonuses, extra, image FROM items WHERE rarity_id = 1 AND slot = ? ORDER BY id LIMIT 1',
        [slot]
      ) as any;
      if (item) {
        packItems.push({
          id: Date.now() + Math.random(),
          name: item.name,
          slot: item.slot,
          rarity_id: item.rarity_id,
          bonuses: JSON.parse(item.bonuses || '{}'),
          extra: JSON.parse(item.extra || '{}'),
          image: item.image || null,
        });
      }
    }

    // 2. 4 шт Фрагмента ужаса (craft_item, rarity_id=2)
    const fragmentItem = await db.one(
      "SELECT id, name, rarity_id, type, image FROM craft_items WHERE name = 'Фрагмент ужаса'"
    ) as any;

    const craftItems: any[] = [];
    if (fragmentItem) {
      for (let i = 0; i < 4; i++) {
        craftItems.push({
          id: Date.now() + Math.random() + i,
          name: fragmentItem.name,
          type: fragmentItem.type,
          rarity_id: fragmentItem.rarity_id,
          image: fragmentItem.image || null,
        });
      }
    }

    // 3. Добавляем всё в инвентарь
    const inventory = JSON.parse(user.inventory || '[]');
    for (const item of packItems) inventory.push(item);
    for (const item of craftItems) inventory.push(item);

    // 4. Считаем премиум и серебро
    const currentPremium = Math.max(user.premiumUntil || 0, now);
    const newPremiumUntil = currentPremium + 7 * 86400; // 7 дней
    const newMoney = (user.money || 0) + 1000;

    // 5. Атомарное обновление
    await db.run(
      'UPDATE users SET inventory = ?, money = ?, premiumUntil = ?, starter_pack_purchased = true WHERE id = ?',
      [JSON.stringify(inventory), newMoney, newPremiumUntil, userId]
    );

    // Уведомление
    sendToUser(userId, { type: 'paymentStatus', status: 'success', platform: 'donate', until: newPremiumUntil });

    logger.info(`[Donate] Starter pack delivered to user ${userId}: ${packItems.length} items + 4 fragments + 1000 silver + 7d premium`);

    return { success: true };
  } catch (err: any) {
    logger.error(`[Donate] deliverStarterPack error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Выдать серебро игроку (вызывается из payment-колбэков)
export async function deliverSilver(userId: number, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.one('SELECT id, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return { success: false, error: 'Пользователь не найден' };

    await db.run('UPDATE users SET money = money + ? WHERE id = ?', [amount, userId]);

    // Уведомление
    sendToUser(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });

    logger.info(`[Donate] ${amount} silver delivered to user ${userId}`);

    return { success: true };
  } catch (err: any) {
    logger.error(`[Donate] deliverSilver error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// GET /api/donate/starter-pack/status — проверить, куплен ли стартовый набор
router.get('/starter-pack/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await db.one('SELECT starter_pack_purchased FROM users WHERE id = ?', [userId]) as any;
    res.json({ purchased: user?.starter_pack_purchased || false });
  } catch {
    res.json({ purchased: false });
  }
});

export default router;
