import { Router } from 'express';
import db from '../database';
import { broadcast } from '../websocket';

const router = Router();

// Все сообщения (для админки)
router.get('/messages', async (req, res) => {
    const messages = await db.prepare(`
    SELECT m.*, s.username as senderName, t.username as targetName
    FROM chat_messages m
    JOIN users s ON m.senderId = s.id
    LEFT JOIN users t ON m.targetId = t.id
    ORDER BY m.createdAt DESC
    LIMIT 200
  `).all();

    const result = messages.map((m: any) => {
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
router.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    await db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
    res.json({ success: true });
});

// Удалить все сообщения
router.delete('/messages', async (req, res) => {
    await db.prepare('DELETE FROM chat_messages').run();
    res.json({ success: true });
});

// Заблокировать игрока в чате на N минут
router.post('/ban-chat', async (req, res) => {
    const { userId, minutes } = req.body;
    if (!userId || !minutes) return res.status(400).json({ error: 'userId и minutes обязательны' });
    const banUntil = Math.floor(Date.now() / 1000) + minutes * 60;
    await db.prepare('UPDATE users SET chatBannedUntil = ? WHERE id = ?').run(banUntil, userId);
    res.json({ success: true, banUntil });
});

// Список забаненных в чате
router.get('/banned', async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const users = await db.prepare(`
    SELECT id, username, chatBannedUntil
    FROM users
    WHERE chatBannedUntil > ?
    ORDER BY chatBannedUntil ASC
  `).all(now);
    res.json(users);
});

// Разбанить игрока
router.post('/unban', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await db.prepare('UPDATE users SET chatBannedUntil = 0 WHERE id = ?').run(userId);
    res.json({ success: true });
});

// Системное сообщение в чат (от system id=0)
router.post('/system-message', async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content обязателен' });
    const info = await db.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)').run(0, null, content);
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