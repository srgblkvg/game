import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { authMiddleware } from '../middleware/auth';
import logger from '../logger';

const router = Router();
const ALL_SLOTS = ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt'];

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

// GET /api/donate/starter-pack/preview — состав набора (для страницы)
router.get('/starter-pack/preview', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const equipment: any[] = [];
    for (const slot of ALL_SLOTS) {
      const item = await db.one(
        `SELECT i.id, i.name, i.slot, i.rarity_id, i.bonuses, i.extra, i.image,
                r.display_name as rarity_display, r.color as rarity_color
         FROM items i JOIN rarities r ON i.rarity_id = r.id
         WHERE i.rarity_id = 2 AND i.slot = ? ORDER BY i.id LIMIT 1`,
        [slot],
      ) as any;
      if (item) {
        equipment.push({
          name: item.name,
          slot: item.slot,
          rarity_id: item.rarity_id,
          rarity_display: item.rarity_display,
          rarity_color: item.rarity_color,
          bonuses: JSON.parse(item.bonuses || '{}'),
          extra: JSON.parse(item.extra || '{}'),
          image: item.image || null,
        });
      }
    }

    const fragment = await db.one(
      "SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = 'Эссенция мрака'",
    ) as any;

    res.json({
      equipment,
      fragment: fragment ? {
        name: fragment.name,
        rarity_id: fragment.rarity_id,
        rarity_display: fragment.rarity_display,
        rarity_color: fragment.rarity_color,
        type: fragment.type,
        image: fragment.image || null,
        count: 4,
      } : null,
    });
  } catch (err: any) {
    logger.error(`[Donate] starter-pack/preview error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Payment rewards are delivered only by provider-specific atomic domain services.
// This router is intentionally read-only: status and preview only.
