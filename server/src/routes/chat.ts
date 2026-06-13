// server/src/routes/chat.ts
import { Router } from 'express';
import db from '../database';

const router = Router();

router.get('/chat/recent', async (req, res) => {
  const userId = req.userId;
  const limit = parseInt(req.query.limit as string) || 20;
  const messages = await db.prepare(`
    SELECT m.*, u.username as senderName
    FROM chat_messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.targetId IS NULL OR m.senderId = ? OR m.targetId = ?
    ORDER BY m.createdAt DESC
    LIMIT ?
  `).all(userId, userId, limit);

  const result = messages.map(async (m) => {
    if (m.item_data) {
      try {
        const item = JSON.parse(m.item_data);
        return { ...m, item, itemRarity: item.rarity };
      } catch { }
    }
    return m;
  });

  res.json(result.reverse());
});

// Получить список собеседников, с которыми у текущего игрока были личные сообщения
router.get('/chat/private/peers', async (req, res) => {
  const userId = req.userId;
  const peers = await db.prepare(`
    SELECT DISTINCT u.id, u.username
    FROM chat_messages m
    JOIN users u ON (u.id = CASE WHEN m.senderId = ? THEN m.targetId ELSE m.senderId END)
    WHERE m.targetId IS NOT NULL AND (m.senderId = ? OR m.targetId = ?)
  `).all(userId, userId, userId);
  res.json(peers);
});

// Получить личные сообщения с конкретным пользователем
router.get('/chat/private/:userId', async (req, res) => {
  const currentUserId = req.userId;
  const otherUserId = parseInt(req.params.userId);
  const limit = parseInt(req.query.limit as string) || 100;
  const messages = await db.prepare(`
    SELECT m.*, u.username as senderName
    FROM chat_messages m
    JOIN users u ON m.senderId = u.id
    WHERE (m.senderId = ? AND m.targetId = ?) OR (m.senderId = ? AND m.targetId = ?)
    ORDER BY m.createdAt DESC
    LIMIT ?
  `).all(currentUserId, otherUserId, otherUserId, currentUserId, limit);

  const result = messages.map(async (m) => {
    if (m.item_data) {
      try {
        const item = JSON.parse(m.item_data);
        return { ...m, item, itemRarity: item.rarity };
      } catch { }
    }
    return m;
  });

  res.json(result.reverse());
});

export default router;