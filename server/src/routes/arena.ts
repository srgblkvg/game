// server/src/routes/arena.ts
import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
import { arenaEnterSchema } from '../validation';

const router = Router();

// Получить случайного соперника (без боя)
router.get('/arena/opponent', (req: any, res) => {
    const userId = req.userId;
    const change = req.query.change === 'true';
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : undefined;

    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    let opponents = db.prepare(
        'SELECT * FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)'
    ).all(userId, now) as any[];

    if (excludeId !== undefined) {
        opponents = opponents.filter((o: any) => o.id !== excludeId);
    }

    if (change) {
        if (opponents.length === 0) {
            return res.status(400).json({ error: 'Нет других соперников' });
        }
        if (user.money < 10) {
            return res.status(400).json({ error: 'Недостаточно монет для смены (10 бронзы)' });
        }
        db.prepare('UPDATE users SET money = money - 10 WHERE id = ?').run(userId);
        user.money -= 10;
    } else {
        if (opponents.length === 0) {
            return res.status(404).json({ error: 'Нет доступных соперников' });
        }
    }

    const opponent = opponents[Math.floor(Math.random() * opponents.length)];
    const base = {
        s: opponent.baseS ?? 5,
        a: opponent.baseA ?? 5,
        d: opponent.baseD ?? 5,
        m: opponent.baseM ?? 5,
    };
    const equipment = JSON.parse(opponent.equipment || '{}');

    // Обогащаем экипировку полями редкости (rarity_display, rarity_color)
    const getItemData = db.prepare(`
        SELECT i.rarity_id, i.image, r.display_name as rarity_display, r.color as rarity_color
        FROM items i JOIN rarities r ON i.rarity_id = r.id
        WHERE i.name = ? AND i.slot = ?
    `);
    const enrichedEquipment: Record<string, any> = {};
    for (const [slotId, item] of Object.entries(equipment) as [string, any][]) {
        if (item && item.slot) {
            const itemRow = getItemData.get(item.name, item.slot) as any;
            if (itemRow) {
                enrichedEquipment[slotId] = {
                    ...item,
                    rarity_id: itemRow.rarity_id,
                    rarity_display: itemRow.rarity_display,
                    rarity_color: itemRow.rarity_color,
                    image: itemRow.image || item.image || null,
                };
            } else {
                enrichedEquipment[slotId] = item;
            }
        } else {
            enrichedEquipment[slotId] = item;
        }
    }

    const stats = currentStats(base, enrichedEquipment);

    res.json({
        id: opponent.id,
        name: opponent.username,
        level: opponent.level,
        equipment: enrichedEquipment,
        stats,
        playerMoney: user.money,
        gender: opponent.gender || 'male',
    });
});

// Вход на арену (платный)
router.post('/arena/enter', (req: any, res) => {
    const parsed = arenaEnterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректный запрос' });

    const userId = req.userId;
    const user = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < 10) return res.status(400).json({ error: 'Недостаточно монет (нужно 10 бронзы)' });

    const now = Math.floor(Date.now() / 1000);
    const count = (db.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)'
    ).get(userId, now) as any).cnt;
    if (count === 0) return res.status(400).json({ error: 'Нет доступных соперников' });

    db.prepare('UPDATE users SET money = money - 10 WHERE id = ?').run(userId);
    res.json({ success: true });
});

// Проверка наличия соперников
router.get('/arena/check-opponent', (req: any, res) => {
    const userId = req.userId;
    const now = Math.floor(Date.now() / 1000);
    const count = (db.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)'
    ).get(userId, now) as any).cnt;
    if (count === 0) return res.status(404).json({ error: 'Нет доступных соперников' });
    res.json({ available: true });
});

export default router;