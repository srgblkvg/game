import { Router } from 'express';
import db from '../database';
import { broadcast } from '../websocket';

const router = Router();

// Все сообщения (для админки)
router.get('/messages', async (req: any, res) => {
    const messages = await db.prepareAll(`
    SELECT m.*, s.username as senderName, t.username as targetName
    FROM chat_messages m
    JOIN users s ON m.senderId = s.id
    LEFT JOIN users t ON m.targetId = t.id
    ORDER BY m.createdAt DESC
    LIMIT 200
  `)();

    const result = messages.map(async (m) => {
        if (m.item_data) {
            try {
                const item = JSON.parse(m.item_data);
                return { ...m, item, itemRarity: item.rarity };
            } catch { }
        }
        return m;
    });

    res.json(result);
});

// Удалить одно сообщение
router.delete('/messages/:id', async (req: any, res) => {
    const { id } = req.params;
    await db.prepareRun('DELETE FROM chat_messages WHERE id = ?')(id);
    res.json({ success: true });
});

// Удалить все сообщения
router.delete('/messages', async (req: any, res) => {
    await db.prepareRun('DELETE FROM chat_messages')();
    res.json({ success: true });
});

// Заблокировать игрока в чате на N минут
router.post('/ban-chat', async (req: any, res) => {
    const { userId, minutes } = req.body;
    if (!userId || !minutes) return res.status(400).json({ error: 'userId и minutes обязательны' });
    const banUntil = Math.floor(Date.now() / 1000) + minutes * 60;
    await db.prepareRun('UPDATE users SET chatBannedUntil = ? WHERE id = ?')(banUntil, userId);
    res.json({ success: true, banUntil });
});

// Список забаненных в чате
router.get('/banned', async (req: any, res) => {
    const now = Math.floor(Date.now() / 1000);
    const users = await db.prepareAll(`
    SELECT id, username, chatBannedUntil
    FROM users
    WHERE chatBannedUntil > ?
    ORDER BY chatBannedUntil ASC
  `)(now);
    res.json(users);
});

// Разбанить игрока
router.post('/unban', async (req: any, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await db.prepareRun('UPDATE users SET chatBannedUntil = 0 WHERE id = ?')(userId);
    res.json({ success: true });
});

// Системное сообщение в чат (от system id=0)
router.post('/system-message', async (req: any, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content обязателен' });
    const info = await db.prepareRun('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)')(0, null, content);
    const msg = {
        id: info.lastInsertRowid,
        senderId: 0,
        senderName: 'system',
        targetId: null,
        content,
        createdAt: new Date().toISOString(),
    };
    broadcast('message', { message: msg });
    res.json({ success: true });
});

export default router;