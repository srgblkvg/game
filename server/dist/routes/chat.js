"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/routes/chat.ts
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const router = (0, express_1.Router)();
router.get('/chat/recent', (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const messages = database_1.default.prepare(`
    SELECT m.*, u.username as senderName
    FROM chat_messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.targetId IS NULL OR m.senderId = ? OR m.targetId = ?
    ORDER BY m.createdAt DESC
    LIMIT ?
  `).all(userId, userId, limit);
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
    res.json(result.reverse());
});
// Получить список собеседников, с которыми у текущего игрока были личные сообщения
router.get('/chat/private/peers', (req, res) => {
    const userId = req.userId;
    const peers = database_1.default.prepare(`
    SELECT DISTINCT u.id, u.username
    FROM chat_messages m
    JOIN users u ON (u.id = CASE WHEN m.senderId = ? THEN m.targetId ELSE m.senderId END)
    WHERE m.targetId IS NOT NULL AND (m.senderId = ? OR m.targetId = ?)
  `).all(userId, userId, userId);
    res.json(peers);
});
// Получить личные сообщения с конкретным пользователем
router.get('/chat/private/:userId', (req, res) => {
    const currentUserId = req.userId;
    const otherUserId = parseInt(req.params.userId);
    const messages = database_1.default.prepare(`
    SELECT m.*, u.username as senderName
    FROM chat_messages m
    JOIN users u ON m.senderId = u.id
    WHERE (m.senderId = ? AND m.targetId = ?) OR (m.senderId = ? AND m.targetId = ?)
    ORDER BY m.createdAt ASC
    LIMIT 100
  `).all(currentUserId, otherUserId, otherUserId, currentUserId);
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
exports.default = router;
//# sourceMappingURL=chat.js.map