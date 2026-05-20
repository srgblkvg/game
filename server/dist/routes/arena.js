"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const stats_1 = require("../game/stats");
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
router.get('/arena/opponent', (req, res) => {
    const userId = req.userId;
    const change = req.query.change === 'true';
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (change) {
        if (user.money < 10)
            return res.status(400).json({ error: 'Недостаточно монет для смены (10 бронзы)' });
        database_1.default.prepare('UPDATE users SET money = money - 10 WHERE id = ?').run(userId);
        user.money -= 10;
    }
    const now = Math.floor(Date.now() / 1000);
    const opponents = database_1.default.prepare('SELECT * FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)').all(userId, now);
    if (opponents.length === 0)
        return res.status(404).json({ error: 'Нет доступных соперников' });
    const opponent = opponents[Math.floor(Math.random() * opponents.length)];
    const base = { s: 5 * Math.pow(2, opponent.level - 1), a: 5 * Math.pow(2, opponent.level - 1), v: 100, d: 5 * Math.pow(2, opponent.level - 1), m: 5 * Math.pow(2, opponent.level - 1) };
    const equipment = JSON.parse(opponent.equipment || '{}');
    const stats = (0, stats_1.currentStats)(base, equipment);
    res.json({
        id: opponent.id,
        name: opponent.username,
        level: opponent.level,
        equipment,
        stats,
        playerMoney: user.money,
        gender: opponent.gender || 'male',
    });
});
router.post('/arena/enter', (req, res) => {
    const parsed = validation_1.arenaEnterSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректный запрос' });
    const userId = req.userId;
    const user = database_1.default.prepare('SELECT money FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.money < 10)
        return res.status(400).json({ error: 'Недостаточно монет (нужно 10 бронзы)' });
    const now = Math.floor(Date.now() / 1000);
    const count = database_1.default.prepare('SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)').get(userId, now).cnt;
    if (count === 0)
        return res.status(400).json({ error: 'Нет доступных соперников' });
    database_1.default.prepare('UPDATE users SET money = money - 10 WHERE id = ?').run(userId);
    res.json({ success: true });
});
router.get('/arena/check-opponent', (req, res) => {
    const userId = req.userId;
    const now = Math.floor(Date.now() / 1000);
    const count = database_1.default.prepare('SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)').get(userId, now).cnt;
    if (count === 0)
        return res.status(404).json({ error: 'Нет доступных соперников' });
    res.json({ available: true });
});
exports.default = router;
//# sourceMappingURL=arena.js.map