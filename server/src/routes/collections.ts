import { Router } from 'express';
import { db } from '../db/index';
import { checkAchievement } from './achievements';

const router = Router();

// Получить коллекцию пользователя (предметы + сеты)
router.get('/collections', async (req, res) => {
    const userId = req.userId;
    const upgradeLevel = parseInt(req.query.upgradelevel as string) || 0;

    const items = await db.query(
        'SELECT itemName, slot, rarity_id, upgradelevel FROM collections WHERE userId = ? AND upgradelevel = ?',
        [userId, upgradeLevel]
    ) as any[];

    // Сеты и их статус — фильтруем по upgradeLevel
    const sets = await db.query(`
        SELECT s.*, si.item_name, si.slot, si.rarity_id,
               i.image, i.bonuses, i.extra,
               r.display_name as rarity_display, r.color as rarity_color,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as collected
        FROM collection_sets s
        LEFT JOIN collection_set_items si ON si.set_id = s.id
        LEFT JOIN items i ON i.name = si.item_name AND i.slot = si.slot AND i.rarity_id = si.rarity_id
        LEFT JOIN rarities r ON si.rarity_id = r.id
        LEFT JOIN collections c ON c.userId = ? AND c.itemName = si.item_name AND c.slot = si.slot AND c.rarity_id = si.rarity_id AND c.upgradelevel = ?
        ORDER BY s.sort_order, s.id, si.slot, si.item_name
    `, [userId, upgradeLevel]) as any[];

    // Группируем по сетам
    const setsMap = new Map<number, { set: any; totalItems: number; collectedCount: number; items: any[] }>();
    for (const row of sets) {
        if (!setsMap.has(row.id)) {
            setsMap.set(row.id, {
                set: {
                    id: row.id, name: row.name, description: row.description,
                    bonus_percent: row.bonus_percent, sort_order: row.sort_order,
                },
                totalItems: 0,
                collectedCount: 0,
                items: [],
            });
        }
        const entry = setsMap.get(row.id)!;
        if (row.item_name) {
            entry.totalItems++;
            if (row.collected) entry.collectedCount++;
            entry.items.push({
                id: row.id,
                name: row.item_name,
                slot: row.slot,
                rarity_id: row.rarity_id || 0,
                rarity_display: row.rarity_display || '',
                rarity_color: row.rarity_color || '#888888',
                image: row.image || null,
                bonuses: typeof row.bonuses === 'string' ? JSON.parse(row.bonuses || '{}') : (row.bonuses || {}),
                extra: typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {}),
                collected: !!row.collected,
            });
        }
    }
    const setsWithStatus = [...setsMap.values()].map(entry => ({
        ...entry.set,
        totalItems: entry.totalItems,
        collectedCount: entry.collectedCount,
        completed: entry.totalItems > 0 && entry.collectedCount === entry.totalItems,
        items: entry.items,
    }));

    res.json({ items, sets: setsWithStatus });
});

// Все предметы из collection_set_items (для клиентской проверки «можно добавить»)
router.get('/collections/set-items', async (req, res) => {
    const items = await db.query('SELECT item_name, slot FROM collection_set_items') as any[];
    res.json(items);
});

// Добавить предмет в коллекцию (удаляет из инвентаря)
router.post('/collections/add', async (req, res) => {
    const userId = req.userId;
    const { itemName, slot, itemId, rarityId, upgradeLevel } = req.body;
    const targetLevel = upgradeLevel ?? 0;

    if (!itemName || !slot) {
        return res.status(400).json({ error: 'itemName и slot обязательны' });
    }

    // Проверяем что предмет ещё не в коллекции (имя+слот+редкость+уровень)
    const existing = await db.one(
        'SELECT id FROM collections WHERE userId = ? AND itemName = ? AND slot = ? AND rarity_id = ? AND upgradelevel = ?',
        [userId, itemName, slot, rarityId || 0, targetLevel]
    );

    if (existing) {
        return res.status(400).json({ error: 'Предмет уже в коллекции' });
    }

    // Удаляем из инвентаря — prefer unlocked, prefer exact itemId
    const user = await db.one('SELECT inventory FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const inventory = JSON.parse(user.inventory || '[]');
    let itemIndex = -1;

    // Ищем по точному itemId (если передан)
    if (itemId !== undefined) {
        itemIndex = inventory.findIndex((item: any) => String(item.id) === String(itemId));
    }
    // Fallback: по имени + слоту, prefer unlocked
    if (itemIndex === -1) {
        const candidates = inventory
            .map((item: any, idx: number) => ({ item, idx }))
            .filter(({ item }: { item: any; idx: number }) => item.name === itemName && item.slot === slot);
        // Сначала unlocked, потом любой
        const unlocked = candidates.find(({ item }: { item: any; idx: number }) => !item.locked);
        const match = unlocked || candidates[0];
        if (match) itemIndex = match.idx;
    }

    if (itemIndex === -1) {
        return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    }

    if (inventory[itemIndex].locked) {
        return res.status(400).json({ error: 'Предмет заблокирован. Разблокируйте в инвентаре.' });
    }

    const removed = inventory.splice(itemIndex, 1)[0];

    await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);

    // Добавляем в коллекцию
    await db.run(
        'INSERT INTO collections (userId, itemName, slot, rarity_id, upgradelevel) VALUES (?, ?, ?, ?, ?)',
        [userId, itemName, slot, removed.rarity_id || 0, targetLevel]
    );
    checkAchievement(userId, 'collection').catch(() => {});

    res.json({ success: true, removed });
});

export default router;
