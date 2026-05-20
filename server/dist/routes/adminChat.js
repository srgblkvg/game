"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const router = (0, express_1.Router)();
// Все сообщения (для админки)
router.get('/messages', (req, res) => {
    const messages = database_1.default.prepare(`
    SELECT m.*, s.username as senderName, t.username as targetName
    FROM chat_messages m
    JOIN users s ON m.senderId = s.id
    LEFT JOIN users t ON m.targetId = t.id
    ORDER BY m.createdAt DESC
    LIMIT 200
  `).all();
    const result = messages.map((m) => {
        if (m.item_data) {
            try {
                const item = JSON.parse(m.item_data);
                return { ...m, item, itemRarity: item.rarity };
            }
            catch { }
        }
        return m;
    });
    res.json(result);
});
// Удалить одно сообщение
router.delete('/messages/:id', (req, res) => {
    const { id } = req.params;
    database_1.default.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
    res.json({ success: true });
});
// Удалить все сообщения
router.delete('/messages', (req, res) => {
    database_1.default.prepare('DELETE FROM chat_messages').run();
    res.json({ success: true });
});
// Заблокировать игрока в чате на N минут
router.post('/ban-chat', (req, res) => {
    const { userId, minutes } = req.body;
    if (!userId || !minutes)
        return res.status(400).json({ error: 'userId и minutes обязательны' });
    const banUntil = Math.floor(Date.now() / 1000) + minutes * 60;
    database_1.default.prepare('UPDATE users SET chatBannedUntil = ? WHERE id = ?').run(banUntil, userId);
    res.json({ success: true, banUntil });
});
// Список забаненных в чате
router.get('/banned', (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const users = database_1.default.prepare(`
    SELECT id, username, chatBannedUntil
    FROM users
    WHERE chatBannedUntil > ?
    ORDER BY chatBannedUntil ASC
  `).all(now);
    res.json(users);
});
// Разбанить игрока
router.post('/unban', (req, res) => {
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    database_1.default.prepare('UPDATE users SET chatBannedUntil = 0 WHERE id = ?').run(userId);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=adminChat.js.map