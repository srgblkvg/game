import { Router } from 'express';
import db from '../database';

const router = Router();

// Получить все сеты
router.get('/collection-sets', (_req: any, res) => {
    const sets = await db.prepareAll('SELECT * FROM collection_sets ORDER BY sort_order')();
    const result = (sets as any[]).map((set: any) => {
        const items = db.prepare(
            'SELECT item_name, slot FROM collection_set_items WHERE set_id = ?'
        ).all(set.id);
        return { ...set, items };
    });
    res.json(result);
});

// Создать сет
router.post('/collection-sets', (req, res) => {
    const { name, description, bonus_percent, sort_order, items } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const info = db.prepare(
        'INSERT INTO collection_sets (name, description, bonus_percent, sort_order) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', bonus_percent || 1, sort_order || 0);

    const setId = info.lastInsertRowid as number;

    if (items && Array.isArray(items)) {
        const insertItem = db.prepare(
            'INSERT OR IGNORE INTO collection_set_items (set_id, item_name, slot) VALUES (?, ?, ?)'
        );
        for (const item of items) {
            insertItem.run(setId, item.item_name, item.slot);
        }
    }

    res.json({ success: true, id: setId });
});

// Обновить сет
router.put('/collection-sets/:id', (req, res) => {
    const { name, description, bonus_percent, sort_order, items } = req.body;
    const setId = Number(req.params.id);

    const existing = await db.prepareGet('SELECT id FROM collection_sets WHERE id = ?')(setId);
    if (!existing) return res.status(404).json({ error: 'Сет не найден' });

    db.prepare(
        'UPDATE collection_sets SET name=?, description=?, bonus_percent=?, sort_order=? WHERE id=?'
    ).run(name, description || '', bonus_percent || 1, sort_order || 0, setId);

    if (items !== undefined) {
        await db.prepareRun('DELETE FROM collection_set_items WHERE set_id = ?')(setId);
        if (Array.isArray(items)) {
            const insertItem = db.prepare(
                'INSERT INTO collection_set_items (set_id, item_name, slot) VALUES (?, ?, ?)'
            );
            for (const item of items) {
                insertItem.run(setId, item.item_name, item.slot);
            }
        }
    }

    res.json({ success: true });
});

// Удалить сет
router.delete('/collection-sets/:id', (req, res) => {
    const setId = Number(req.params.id);
    await db.prepareRun('DELETE FROM collection_set_items WHERE set_id = ?')(setId);
    await db.prepareRun('DELETE FROM collection_sets WHERE id = ?')(setId);
    res.json({ success: true });
});

export default router;
