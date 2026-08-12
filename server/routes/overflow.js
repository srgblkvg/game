"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToOverflow = addToOverflow;
exports.isInventoryFull = isInventoryFull;
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Получить все предметы на складе
router.get('/', async (req, res) => {
    const userId = req.userId;
    const items = await index_1.db.query('SELECT id, item, auctionlotid as auctionLotId, createdat as createdAt FROM overflow_storage WHERE userId = ? ORDER BY id', [userId]);
    res.json(items.map((r) => ({
        id: r.id,
        item: typeof r.item === 'string' ? JSON.parse(r.item) : r.item,
        auctionLotId: r.auctionlotid ?? r.auctionLotId ?? null,
        createdAt: r.createdat ?? r.createdAt,
    })));
});
// Забрать предмет в инвентарь
router.post('/take/:id', async (req, res) => {
    const userId = req.userId;
    const id = parseInt(req.params.id);
    const row = await index_1.db.one('SELECT * FROM overflow_storage WHERE id = ? AND userId = ?', [id, userId]);
    if (!row)
        return res.status(404).json({ error: 'Предмет не найден' });
    const user = await index_1.db.one('SELECT inventory, inventorySlots FROM users WHERE id = ?', [userId]);
    const inventory = typeof user.inventory === 'string' ? JSON.parse(user.inventory) : (user.inventory || []);
    const maxSlots = user.inventorySlots || 10;
    const item = typeof row.item === 'string' ? JSON.parse(row.item) : row.item;
    const isGear = !!item.slot;
    const isCraft = item.type === 'craft_item' || item.type === 'material' || item.type === 'upgrade';
    const equipCount = inventory.filter((i) => !!i.slot).length;
    if (isGear && equipCount >= maxSlots) {
        return res.status(400).json({ error: 'Инвентарь заполнен' });
    }
    // Стакаем ресурсы в инвентаре
    if (isCraft) {
        const existingIdx = inventory.findIndex((i) => (i.type === 'craft_item' || i.type === 'material' || i.type === 'upgrade') && String(i.id) === String(item.id));
        if (existingIdx !== -1) {
            inventory[existingIdx].count = (inventory[existingIdx].count || 0) + (item.count || 1);
            await index_1.db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
            await index_1.db.run('DELETE FROM overflow_storage WHERE id = ?', [id]);
            return res.json({ success: true, inventory, remainingSlots: maxSlots - inventory.length, stacked: true });
        }
    }
    inventory.push(item);
    await index_1.db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    await index_1.db.run('DELETE FROM overflow_storage WHERE id = ?', [id]);
    res.json({ success: true, inventory, remainingSlots: maxSlots - inventory.length });
});
// Добавить предмет на склад (вызывается из аукциона)
async function addToOverflow(userId, item, auctionLotId) {
    // Стакаем ресурсы: если такой же уже на складе — увеличиваем count
    const isCraft = item.type === 'craft_item' || item.type === 'material' || item.type === 'upgrade';
    if (isCraft) {
        const rows = await index_1.db.query("SELECT id, item FROM overflow_storage WHERE userId = ? AND item->>'id' = ? AND item->>'type' = ? LIMIT 1", [userId, String(item.id), item.type]);
        if (rows.length > 0) {
            const existing = rows[0];
            const existingItem = typeof existing.item === 'string' ? JSON.parse(existing.item) : existing.item;
            existingItem.count = (existingItem.count || 0) + (item.count || 1);
            await index_1.db.run('UPDATE overflow_storage SET item = ? WHERE id = ?', [JSON.stringify(existingItem), existing.id]);
            return;
        }
    }
    await index_1.db.run('INSERT INTO overflow_storage (userId, item, auctionLotId) VALUES (?, ?, ?)', [userId, JSON.stringify(item), auctionLotId || null]);
}
// Получить + вывести серебро со склада
router.get('/money', async (req, res) => {
    const userId = req.userId;
    const u = await index_1.db.one('SELECT overflowmoney FROM users WHERE id = ?', [userId]);
    res.json({ overflowmoney: u?.overflowmoney || 0 });
});
router.post('/money/withdraw', async (req, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount) || 0;
    if (amount <= 0)
        return res.status(400).json({ error: 'Укажите сумму' });
    const u = await index_1.db.one('SELECT overflowmoney FROM users WHERE id = ?', [userId]);
    if (!u || (u.overflowmoney || 0) < amount)
        return res.status(400).json({ error: 'Недостаточно на складе' });
    await index_1.db.run('UPDATE users SET money = money + ?, overflowmoney = overflowmoney - ? WHERE id = ?', [amount, amount, userId]);
    res.json({ success: true, withdrawn: amount, remaining: (u.overflowmoney || 0) - amount });
});
// Проверить заполненность инвентаря
async function isInventoryFull(userId) {
    const u = await index_1.db.one('SELECT inventory, inventorySlots FROM users WHERE id = ?', [userId]);
    const inv = typeof u.inventory === 'string' ? JSON.parse(u.inventory) : (u.inventory || []);
    return inv.length >= (u.inventoryslots || u.inventorySlots || 10);
}
exports.default = router;
//# sourceMappingURL=overflow.js.map