import { Router } from 'express';
import db from '../database';

const router = Router();

const rankNames: Record<string, string> = {
    master: 'Магистр', officer: 'Офицер', veteran: 'Ветеран', fighter: 'Боец', recruit: 'Рекрут',
};

// Список орденов
router.get('/orders', (req: any, res) => {
    const orders = db.prepare(`
        SELECT o.*, u.username as masterName,
            (SELECT COUNT(*) FROM order_members WHERE orderId = o.id) as memberCount
        FROM orders o JOIN users u ON o.masterId = u.id ORDER BY o.level DESC, o.exp DESC
    `).all();
    res.json(orders);
});

// Мой орден
router.get('/orders/my', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT * FROM order_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.json({ order: null });

    const order = db.prepare(`
        SELECT o.*, u.username as masterName FROM orders o JOIN users u ON o.masterId = u.id WHERE o.id = ?
    `).get(member.orderId) as any;

    const members = db.prepare(`
        SELECT om.*, u.username, u.level FROM order_members om JOIN users u ON om.userId = u.id WHERE om.orderId = ? ORDER BY CASE om.rank WHEN 'master' THEN 1 WHEN 'officer' THEN 2 WHEN 'veteran' THEN 3 WHEN 'fighter' THEN 4 ELSE 5 END
    `).all(member.orderId);

    res.json({ order: { ...order, members } });
});

// Создать орден
router.post('/orders/create', (req: any, res) => {
    const userId = req.userId;
    const { name } = req.body;
    if (!name || name.length < 2) return res.status(400).json({ error: 'Имя ордена от 2 символов' });

    const user = db.prepare('SELECT level, money FROM users WHERE id = ?').get(userId) as any;
    if (user.level < 5) return res.status(400).json({ error: 'Нужен 5 уровень' });
    if (user.money < 5000) return res.status(400).json({ error: 'Нужно 5000 🥇' });

    const existing = db.prepare('SELECT id FROM orders WHERE name = ?').get(name);
    if (existing) return res.status(400).json({ error: 'Имя занято' });

    const memberCheck = db.prepare('SELECT id FROM order_members WHERE userId = ?').get(userId);
    if (memberCheck) return res.status(400).json({ error: 'Вы уже в ордене' });

    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE users SET money = money - 5000 WHERE id = ?').run(userId);
    const result = db.prepare('INSERT INTO orders (name, masterId, createdAt) VALUES (?, ?, ?)').run(name, userId, now);
    db.prepare('INSERT INTO order_members (orderId, userId, rank, joinedAt) VALUES (?, ?, ?, ?)').run(result.lastInsertRowid, userId, 'master', now);

    res.json({ success: true, orderId: result.lastInsertRowid });
});

// Вступить в орден
router.post('/orders/join', (req: any, res) => {
    const userId = req.userId;
    const { orderId } = req.body;

    const memberCheck = db.prepare('SELECT id FROM order_members WHERE userId = ?').get(userId);
    if (memberCheck) return res.status(400).json({ error: 'Вы уже в ордене' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return res.status(404).json({ error: 'Орден не найден' });

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM order_members WHERE orderId = ?').get(orderId) as any).cnt;
    const maxMembers = Math.min(25, 10 + order.level);
    if (count >= maxMembers) return res.status(400).json({ error: 'Орден заполнен' });

    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO order_members (orderId, userId, rank, joinedAt) VALUES (?, ?, ?, ?)').run(orderId, userId, 'recruit', now);
    res.json({ success: true });
});

// Покинуть орден
router.post('/orders/leave', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT * FROM order_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в ордене' });
    if (member.rank === 'master') return res.status(400).json({ error: 'Магистр не может покинуть орден. Передайте титул или распустите орден.' });

    db.prepare('DELETE FROM order_members WHERE userId = ?').run(userId);
    res.json({ success: true });
});

// Пожертвовать в казну
router.post('/orders/donate', (req: any, res) => {
    const userId = req.userId;
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const member = db.prepare('SELECT * FROM order_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в ордене' });

    const user = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    if (user.money < amount) return res.status(400).json({ error: 'Недостаточно монет' });

    db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(amount, userId);
    db.prepare('UPDATE orders SET treasury = treasury + ?, exp = exp + ? WHERE id = ?').run(amount, Math.floor(amount / 100), member.orderId);
    res.json({ success: true });
});

// Повысить/понизить участника (магистр/офицер)
router.post('/orders/promote', (req: any, res) => {
    const userId = req.userId;
    const { targetUserId, newRank } = req.body;
    if (!['officer', 'veteran', 'fighter', 'recruit'].includes(newRank)) return res.status(400).json({ error: 'Недопустимый ранг' });

    const myMembership = db.prepare('SELECT * FROM order_members WHERE userId = ?').get(userId) as any;
    if (!myMembership || !['master', 'officer'].includes(myMembership.rank)) return res.status(403).json({ error: 'Нет прав' });

    const target = db.prepare('SELECT * FROM order_members WHERE userId = ? AND orderId = ?').get(targetUserId, myMembership.orderId) as any;
    if (!target) return res.status(404).json({ error: 'Участник не найден' });
    if (target.rank === 'master') return res.status(400).json({ error: 'Нельзя изменить ранг магистра' });

    db.prepare('UPDATE order_members SET rank = ? WHERE userId = ?').run(newRank, targetUserId);
    res.json({ success: true });
});

// Исключить участника
router.post('/orders/kick', (req: any, res) => {
    const userId = req.userId;
    const { targetUserId } = req.body;

    const myMembership = db.prepare('SELECT * FROM order_members WHERE userId = ?').get(userId) as any;
    if (!myMembership || !['master', 'officer'].includes(myMembership.rank)) return res.status(403).json({ error: 'Нет прав' });

    const target = db.prepare('SELECT * FROM order_members WHERE userId = ? AND orderId = ?').get(targetUserId, myMembership.orderId) as any;
    if (!target) return res.status(404).json({ error: 'Участник не найден' });
    if (target.rank === 'master') return res.status(400).json({ error: 'Нельзя исключить магистра' });

    db.prepare('DELETE FROM order_members WHERE userId = ?').run(targetUserId);
    res.json({ success: true });
});

export default router;
