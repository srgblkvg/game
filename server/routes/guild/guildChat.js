"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../../db/index");
const events_1 = require("../../events");
const router = (0, express_1.Router)();
router.get('/guild/chat', async (req, res) => {
    const userId = req.userId;
    const member = await index_1.db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]);
    if (!member)
        return res.status(400).json({ error: 'Вы не в гильдии' });
    const guildId = member.guildId;
    const messages = await index_1.db.query(`
        SELECT m.*, u.username as senderName
        FROM chat_messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.targetId = ?
        ORDER BY m.createdAt DESC
        LIMIT 10
    `, [-guildId]);
    res.json(messages.reverse());
});
router.post('/guild/chat', async (req, res) => {
    const userId = req.userId;
    const { content } = req.body;
    if (!content)
        return res.status(400).json({ error: 'Пустое сообщение' });
    const member = await index_1.db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]);
    if (!member)
        return res.status(400).json({ error: 'Вы не в гильдии' });
    const guildId = member.guildId;
    const sender = await index_1.db.one('SELECT username FROM users WHERE id = ?', [userId]);
    const info = await index_1.db.run('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)', [userId, -guildId, content]);
    const msg = {
        id: info.lastInsertRowid,
        senderId: userId,
        senderName: sender.username,
        targetId: -guildId,
        content,
        createdAt: new Date().toISOString(),
    };
    // Рассылаем всем членам гильдии через sendToGuild
    (0, events_1.sendToGuild)(guildId, { type: 'message', message: msg });
    res.json({ success: true, message: msg });
});
// Публичная информация о гильдии
exports.default = router;
//# sourceMappingURL=guildChat.js.map