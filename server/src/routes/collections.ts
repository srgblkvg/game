import { Router } from 'express';
import db from '../database';

const router = Router();

// Получить коллекцию пользователя (предметы + сеты)
router.get('/collections', (req: any, res) => {
    const userId = req.userId;
    const items = db.prepare(
        'SELECT itemName, slot, rarity_id FROM collections WHERE userId = ?'
    ).all(userId) as any[];

    // Сеты и их статус
    const sets = db.prepare('SELECT * FROM collection_sets ORDER BY sort_order').all() as any[];
    const setsWithStatus = sets.map((set: any) => {
        const setItems = db.prepare(
            'SELECT item_name, slot FROM collection_set_items WHERE set_id = ?'
        ).all(set.id) as any[];
        const collectedCount = setItems.filter((si: any) =>
            items.some((ci: any) => ci.itemName === si.item_name && ci.slot === si.slot)
        ).length;
        return {
            ...set,
            totalItems: setItems.length,
            collectedCount,
            completed: collectedCount === setItems.length && setItems.length > 0,
        };
    });

    res.json({ items, sets: setsWithStatus });
});

// Добавить предмет в коллекцию (удаляет из инвентаря)
router.post('/collections/add', (req: any, res) => {
    const userId = req.userId;
    const { itemName, slot, itemId } = req.body;

    if (!itemName || !slot) {
        return res.status(400).json({ error: 'itemName и slot обязательны' });
    }

    // Проверяем что предмет ещё не в коллекции
    const existing = db.prepare(
        'SELECT id FROM collections WHERE userId = ? AND itemName = ? AND slot = ?'
    ).get(userId, itemName, slot);

    if (existing) {
        return res.status(400).json({ error: 'Предмет уже в коллекции' });
    }

    // Удаляем из инвентаря
    const user = db.prepare('SELECT inventory FROM users WHERE id = ?').get(userId) as any;
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

    db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);

    // Добавляем в коллекцию
    db.prepare(
        'INSERT INTO collections (userId, itemName, slot, rarity_id) VALUES (?, ?, ?, ?)'
    ).run(userId, itemName, slot, removed.rarity_id || 0);

    res.json({ success: true, removed });
});

export default router;
