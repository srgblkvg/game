"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Получить все сеты
router.get('/collection-sets', async (req, res) => {
    const sets = await index_1.db.query('SELECT * FROM collection_sets ORDER BY sort_order', []);
    const result = await Promise.all(sets.map(async (set) => {
        const items = await index_1.db.query('SELECT item_name, slot FROM collection_set_items WHERE set_id = ?', [set.id]);
        return { ...set, items };
    }));
    res.json(result);
});
// Создать сет
router.post('/collection-sets', async (req, res) => {
    const { name, description, bonus_percent, sort_order, items } = req.body;
    if (!name)
        return res.status(400).json({ error: 'name required' });
    const info = await index_1.db.run('INSERT INTO collection_sets (name, description, bonus_percent, sort_order) VALUES (?, ?, ?, ?)', [name, description || '', bonus_percent || 1, sort_order || 0]);
    const setId = info.lastInsertRowid;
    if (items && Array.isArray(items)) {
        for (const item of items) {
            await index_1.db.run('INSERT OR IGNORE INTO collection_set_items (set_id, item_name, slot) VALUES (?, ?, ?)', [setId, item.item_name, item.slot]);
        }
    }
    res.json({ success: true, id: setId });
});
// Обновить сет
router.put('/collection-sets/:id', async (req, res) => {
    const { name, description, bonus_percent, sort_order, items } = req.body;
    const setId = Number(req.params.id);
    const existing = await index_1.db.one('SELECT id FROM collection_sets WHERE id = ?', [setId]);
    if (!existing)
        return res.status(404).json({ error: 'Сет не найден' });
    await index_1.db.run('UPDATE collection_sets SET name=?, description=?, bonus_percent=?, sort_order=? WHERE id=?', [name, description || '', bonus_percent || 1, sort_order || 0, setId]);
    if (items !== undefined) {
        await index_1.db.run('DELETE FROM collection_set_items WHERE set_id = ?', [setId]);
        if (Array.isArray(items)) {
            for (const item of items) {
                await index_1.db.run('INSERT INTO collection_set_items (set_id, item_name, slot) VALUES (?, ?, ?)', [setId, item.item_name, item.slot]);
            }
        }
    }
    res.json({ success: true });
});
// Удалить сет
router.delete('/collection-sets/:id', async (req, res) => {
    const setId = Number(req.params.id);
    await index_1.db.run('DELETE FROM collection_set_items WHERE set_id = ?', [setId]);
    await index_1.db.run('DELETE FROM collection_sets WHERE id = ?', [setId]);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=adminCollections.js.map