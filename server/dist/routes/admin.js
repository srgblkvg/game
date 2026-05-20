"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
router.get('/items', (req, res) => {
    const items = database_1.default.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
    res.json(items);
});
router.post('/items', (req, res) => {
    const parsed = validation_1.createItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });
    const { name, slot, rarity, bonuses, extra, image } = parsed.data; // image добавлено
    database_1.default.prepare('INSERT INTO items (name, slot, rarity, bonuses, extra, image) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, slot, rarity, JSON.stringify(bonuses || {}), JSON.stringify(extra || {}), image || null);
    res.json({ success: true });
});
router.put('/items/:id', (req, res) => {
    const parsed = validation_1.createItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });
    const { name, slot, rarity, bonuses, extra, image } = parsed.data;
    database_1.default.prepare('UPDATE items SET name=?, slot=?, rarity=?, bonuses=?, extra=?, image=? WHERE id=?')
        .run(name, slot, rarity, JSON.stringify(bonuses), JSON.stringify(extra), image || null, req.params.id);
    res.json({ success: true });
});
router.delete('/items/:id', (req, res) => {
    database_1.default.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});
router.get('/users', (req, res) => {
    const users = database_1.default.prepare('SELECT id, username, level, money, totalBattles, wins, lastAttackTime, protectionUntil, activeJob, inventorySlots FROM users ORDER BY id').all();
    res.json(users);
});
router.post('/add-money', (req, res) => {
    const parsed = validation_1.addMoneySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { userId, amount } = parsed.data;
    const user = database_1.default.prepare('SELECT id, money FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const newMoney = user.money + amount;
    database_1.default.prepare('UPDATE users SET money = ? WHERE id = ?').run(newMoney, userId);
    res.json({ success: true, newMoney });
});
router.post('/reset-timers', (req, res) => {
    const parsed = validation_1.resetTimersSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { all, userId } = parsed.data;
    if (all) {
        database_1.default.prepare('UPDATE users SET lastAttackTime = 0, protectionUntil = 0').run();
        return res.json({ success: true });
    }
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    database_1.default.prepare('UPDATE users SET lastAttackTime = 0, protectionUntil = 0 WHERE id = ?').run(userId);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=admin.js.map