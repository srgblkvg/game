import { Router } from 'express';
import db from '../database';

const router = Router();

// Все сообщения (для админки)
router.get('/messages', (req: any, res) => {
    const messages = db.prepare(`
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
router.delete('/messages/:id', (req: any, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
    res.json({ success: true });
});

// Удалить все сообщения
router.delete('/messages', (req: any, res) => {
    db.prepare('DELETE FROM chat_messages').run();
    res.json({ success: true });
});

// Заблокировать игрока в чате на N минут
router.post('/ban-chat', (req: any, res) => {
    const { userId, minutes } = req.body;
    if (!userId || !minutes) return res.status(400).json({ error: 'userId и minutes обязательны' });
    const banUntil = Math.floor(Date.now() / 1000) + minutes * 60;
    db.prepare('UPDATE users SET chatBannedUntil = ? WHERE id = ?').run(banUntil, userId);
    res.json({ success: true, banUntil });
});

// Список забаненных в чате
router.get('/banned', (req: any, res) => {
    const now = Math.floor(Date.now() / 1000);
    const users = db.prepare(`
    SELECT id, username, chatBannedUntil
    FROM users
    WHERE chatBannedUntil > ?
    ORDER BY chatBannedUntil ASC
  `).all(now);
    res.json(users);
});

// Разбанить игрока
router.post('/unban', (req: any, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    db.prepare('UPDATE users SET chatBannedUntil = 0 WHERE id = ?').run(userId);
    res.json({ success: true });
});

export default router;