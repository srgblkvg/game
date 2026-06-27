import { Router } from "express";
import { db } from "../../db/index";
import { isGuildAtWar } from "./guildWar";
import { broadcast, sendToGuild } from "../../events";

const router = Router();

router.get('/guild/chat', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const guildId = member.guildId;
    const messages = await db.query(`
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
    if (!content) return res.status(400).json({ error: 'Пустое сообщение' });

    const member = await db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const guildId = member.guildId;
    const sender = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    const info = await db.run(
        'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)',
        [userId, -guildId, content]
    );

    const msg = {
        id: info.lastInsertRowid,
        senderId: userId,
        senderName: sender.username,
        targetId: -guildId,
        content,
        createdAt: new Date().toISOString(),
    };

    // Рассылаем всем членам гильдии через sendToGuild
    sendToGuild(guildId, { type: 'message', message: msg });

    res.json({ success: true, message: msg });
});

// Публичная информация о гильдии

export default router;
