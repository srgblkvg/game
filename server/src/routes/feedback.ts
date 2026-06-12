import { Router } from 'express';
import db from '../database';

const router = Router();

// Отправить обращение
router.post('/feedback', (req: any, res) => {
    const userId = req.userId;
    const { subject, message } = req.body;
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Укажите тему' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Введите сообщение' });

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    db.prepare(
        'INSERT INTO feedback_messages (userId, username, subject, message) VALUES (?, ?, ?, ?)'
    ).run(userId, user.username, subject.trim(), message.trim());

    res.json({ success: true, message: 'Обращение отправлено' });
});

// Админ: список обращений
router.get('/admin/feedback', (req: any, res) => {
    if (req.userRole !== 'admin') return res.status(403).json({ error: 'Нет доступа' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM feedback_messages').get() as any).cnt;
    const messages = db.prepare(
        'SELECT * FROM feedback_messages ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
});

// Админ: отметить прочитанным
router.post('/admin/feedback/read', (req: any, res) => {
    if (req.userRole !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
    const { id } = req.body;
    db.prepare('UPDATE feedback_messages SET read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
});

export default router;
