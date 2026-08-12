"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminFeedbackRouter = void 0;
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
exports.adminFeedbackRouter = (0, express_1.Router)();
// Отправить обращение (публичный)
router.post('/feedback', async (req, res) => {
    const userId = req.userId;
    const { subject, message } = req.body;
    if (!subject || !subject.trim())
        return res.status(400).json({ error: 'Укажите тему' });
    if (!message || !message.trim())
        return res.status(400).json({ error: 'Введите сообщение' });
    const user = await index_1.db.one('SELECT username FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(400).json({ error: 'Пользователь не найден' });
    await index_1.db.run('INSERT INTO feedback_messages (userid, username, subject, message, createdat) VALUES (?, ?, ?, ?, ?)', [userId, user.username, subject.trim(), message.trim(), new Date().toISOString()]);
    res.json({ success: true, message: 'Обращение отправлено' });
});
// Админ: список обращений
exports.adminFeedbackRouter.get('/feedback', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = (await index_1.db.one('SELECT COUNT(*) as cnt FROM feedback_messages', [])).cnt;
    const messages = await index_1.db.query('SELECT * FROM feedback_messages ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
});
// Админ: отметить прочитанным
exports.adminFeedbackRouter.post('/feedback/read', async (req, res) => {
    const { id } = req.body;
    await index_1.db.run('UPDATE feedback_messages SET read = 1 WHERE id = ?', [id]);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=feedback.js.map