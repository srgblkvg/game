import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

// Получить коллекцию пользователя (предметы + сеты)
router.get('/collections', async (req, res) => {
    const userId = req.userId;
    const items = await db.query(
        'SELECT itemName, slot, rarity_id FROM collections WHERE userId = ?',
        [userId]
    ) as any[];

    // Сеты и их статус (один JOIN вместо N+1)
    const sets = await db.query(`
        SELECT s.*, si.item_name, si.slot,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as collected
        FROM collection_sets s
        LEFT JOIN collection_set_items si ON si.set_id = s.id
        LEFT JOIN collections c ON c.userId = ? AND c.itemName = si.item_name AND c.slot = si.slot
        ORDER BY s.sort_order, s.id
    `, [userId]) as any[];

    // Группируем по сетам
    const setsMap = new Map<number, { set: any; totalItems: number; collectedCount: number }>();
    for (const row of sets) {
        if (!setsMap.has(row.id)) {
            setsMap.set(row.id, {
                set: { id: row.id, name: row.name, description: row.description, bonus_percent: row.bonus_percent, sort_order: row.sort_order },
                totalItems: 0,
                collectedCount: 0,
            });
        }
        const entry = setsMap.get(row.id)!;
        if (row.item_name) {
            entry.totalItems++;
            if (row.collected) entry.collectedCount++;
        }
    }
    const setsWithStatus = [...setsMap.values()].map(entry => ({
        ...entry.set,
        totalItems: entry.totalItems,
        collectedCount: entry.collectedCount,
        completed: entry.totalItems > 0 && entry.collectedCount === entry.totalItems,
    }));

    res.json({ items, sets: setsWithStatus });
});

// Добавить предмет в коллекцию (удаляет из инвентаря)
router.post('/collections/add', async (req, res) => {
    const userId = req.userId;
    const { itemName, slot, itemId } = req.body;

    if (!itemName || !slot) {
        return res.status(400).json({ error: 'itemName и slot обязательны' });
    }

    // Проверяем что предмет ещё не в коллекции
    const existing = await db.one(
        'SELECT id FROM collections WHERE userId = ? AND itemName = ? AND slot = ?',
        [userId, itemName, slot]
    );

    if (existing) {
        return res.status(400).json({ error: 'Предмет уже в коллекции' });
    }

    // Удаляем из инвентаря
    const user = await db.one('SELECT inventory FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const inventory = JSON.parse(user.inventory || '[]');
    const itemIndex = inventory.findIndex((item: any) => {
        if (itemId !== undefined && item.id === itemId) return true;
        return item.name === itemName && item.slot === slot;
    });

    if (itemIndex === -1) {
        return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    }

    const removed = inventory.splice(itemIndex, 1)[0];

    await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);

    // Добавляем в коллекцию
    await db.run(
        'INSERT INTO collections (userId, itemName, slot, rarity_id) VALUES (?, ?, ?, ?)',
        [userId, itemName, slot, removed.rarity_id || 0]
    );

    res.json({ success: true, removed });
});

export default router;
