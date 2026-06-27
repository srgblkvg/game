// server/src/routes/chat.ts
import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

router.get('/chat/recent', async (req, res) => {
  const userId = req.userId;
  const limit = parseInt(req.query.limit as string) || 20;
  const messages = await db.query(`
    SELECT m.*, u.username as senderName
    FROM chat_messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.targetId IS NULL OR m.senderId = ? OR m.targetId = ?
    ORDER BY m.createdAt DESC
    LIMIT ?
  `, [userId, userId, limit]);

  const result = messages.map((m) => {
    const msg = { ...m, content: m.content || '' };
    if (m.item_data) {
      try {
        const item = JSON.parse(m.item_data);
        return { ...msg, item, itemRarity: item.rarity ?? item.rarity_id };
      } catch { }
    }
    return msg;
  });

  res.json(result.reverse());
});

// Получить список собеседников, с которыми у текущего игрока были личные сообщения
router.get('/chat/private/peers', async (req, res) => {
  const userId = req.userId;
  const peers = await db.query(`
    SELECT DISTINCT u.id, u.username
    FROM chat_messages m
    JOIN users u ON (u.id = CASE WHEN m.senderId = ? THEN m.targetId ELSE m.senderId END)
    WHERE m.targetId IS NOT NULL AND (m.senderId = ? OR m.targetId = ?)
  `, [userId, userId, userId]);
  res.json(peers);
});

// Получить личные сообщения с конкретным пользователем
router.get('/chat/private/:userId', async (req, res) => {
  const currentUserId = req.userId;
  const otherUserId = parseInt(req.params.userId);
  const limit = parseInt(req.query.limit as string) || 100;
  const messages = await db.query(`
    SELECT m.*, u.username as senderName
    FROM chat_messages m
    JOIN users u ON m.senderId = u.id
    WHERE (m.senderId = ? AND m.targetId = ?) OR (m.senderId = ? AND m.targetId = ?)
    ORDER BY m.createdAt DESC
    LIMIT ?
  `, [currentUserId, otherUserId, otherUserId, currentUserId, limit]);

  const result = messages.map((m) => {
    const msg = { ...m, content: m.content || '' };
    if (m.item_data) {
      try {
        const item = JSON.parse(m.item_data);
        return { ...msg, item, itemRarity: item.rarity ?? item.rarity_id };
      } catch { }
    }
    return msg;
  });

  res.json(result.reverse());
});


// Системные сообщения (зарплата и т.д.)
router.get('/chat/system', async (req, res) => {
    try {
        const userId = (req as any).userId;
        if (!userId) return res.status(401).json({ error: 'Не авторизован' });
        const msgs = await db.query(
            "SELECT * FROM chat_messages WHERE senderId = ? AND targetId = ? AND content LIKE ? ORDER BY id DESC LIMIT 50",
            [0, userId, '💰%']
        ) as any[];
        res.json(msgs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Отправка сообщения (замена WebSocket)
import xss from 'xss';
const sanitize = (text: string) => xss(text, { whiteList: {}, stripIgnoreTag: true });

router.post('/chat/send', async (req, res) => {
    try {
        const userId = req.userId;
        const { type, content, targetUserId, itemId, itemData } = req.body;

        if (!content && !itemId) return res.status(400).json({ error: 'Нет содержимого' });

        const user = await db.one('SELECT username, guildId, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?', [userId]) as any;
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const now = new Date().toISOString();

        if (itemId || itemData) {
            // Отправка предмета
            let item = itemData;
            if (!item && itemId) {
                const userRow = await db.one('SELECT inventory FROM users WHERE id = ?', [userId]) as any;
                const inventory = JSON.parse(userRow.inventory || '[]');
                item = inventory.find((i: any) => i.id == itemId);
            }
            if (!item) return res.status(400).json({ error: 'Предмет не найден' });
            const itemDataJson = JSON.stringify(item);
            const itemName = sanitize(item.name);
            const info = await db.run(
                'INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, NULL, ?, ?)',
                [userId, `[${itemName}]`, itemDataJson]
            );
            return res.json({ id: info.lastInsertRowid, senderId: userId, senderName: user.username, senderGuild: user.guildname || null, targetId: null, content: `[${itemName}]`, createdAt: now, item, itemRarity: item.rarity_id ?? item.rarity });
        }

        if (type === 'private' && targetUserId) {
            const sanitizedContent = sanitize(content.trim());
            const info = await db.run(
                'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)',
                [userId, targetUserId, sanitizedContent]
            );
            return res.json({ id: info.lastInsertRowid, senderId: userId, senderName: user.username, targetId: targetUserId, content: sanitizedContent, createdAt: now });
        }

        // public
        const sanitizedContent = sanitize(content.trim());
        const info = await db.run(
            'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, NULL, ?)',
            [userId, sanitizedContent]
        );
        res.json({ id: info.lastInsertRowid, senderId: userId, senderName: user.username, senderGuild: user.guildname || null, senderGuildId: user.guildId || null, targetId: null, content: sanitizedContent, createdAt: now });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
