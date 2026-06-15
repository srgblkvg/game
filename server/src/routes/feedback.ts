import { Router } from 'express';
import { db } from '../db/index';

const router = Router();
export const adminFeedbackRouter = Router();

// Отправить обращение (публичный)
router.post('/feedback', async (req, res) => {
    const userId = req.userId;
    const { subject, message } = req.body;
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Укажите тему' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Введите сообщение' });

    const user = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    await db.run(
        'INSERT INTO feedback_messages (userid, username, subject, message, createdat) VALUES (?, ?, ?, ?, ?)',
        [userId, user.username, subject.trim(), message.trim(), new Date().toISOString()]
    );

    res.json({ success: true, message: 'Обращение отправлено' });
});

// Админ: список обращений
adminFeedbackRouter.get('/feedback', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const total = (await db.one('SELECT COUNT(*) as cnt FROM feedback_messages', []) as any).cnt;
    const messages = await db.query(
        'SELECT * FROM feedback_messages ORDER BY id DESC LIMIT ? OFFSET ?',
        [limit, offset]
    );

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
});

// Админ: отметить прочитанным
adminFeedbackRouter.post('/feedback/read', async (req, res) => {
    const { id } = req.body;
    await db.run('UPDATE feedback_messages SET read = 1 WHERE id = ?', [id]);
    res.json({ success: true });
});

export default router;
