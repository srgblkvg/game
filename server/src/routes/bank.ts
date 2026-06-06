import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

// Все маршруты банка требуют полный доступ (гости заблокированы)
router.use('/bank', requireFullAccess);

// Получить состояние банка
router.get('/bank', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT money, bank, accountNumber FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
        pocket: user.money || 0,
        bank: user.bank || 0,
        accountNumber: user.accountNumber,
    });
});

// Положить в банк
router.post('/bank/deposit', (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const user = db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < amount) return res.status(400).json({ error: 'Недостаточно монет' });

    const commission = Math.ceil(amount * 0.02);
    const depositAmount = amount - commission;

    db.prepare('UPDATE users SET money = money - ?, bank = bank + ? WHERE id = ?')
        .run(amount, depositAmount, userId);

    db.prepare('INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES (?, ?, ?, ?, ?)')
        .run(userId, 'deposit', amount, commission, depositAmount);

    const updated = db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, pocket: updated.money, bank: updated.bank, commission, deposited: depositAmount });
});

// Снять из банка
router.post('/bank/withdraw', (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const user = db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.bank < amount) return res.status(400).json({ error: 'Недостаточно монет в банке' });

    db.prepare('UPDATE users SET money = money + ?, bank = bank - ? WHERE id = ?')
        .run(amount, amount, userId);

    db.prepare('INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES (?, ?, ?, ?, ?)')
        .run(userId, 'withdraw', amount, 0, amount);

    const updated = db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, pocket: updated.money, bank: updated.bank, withdrawn: amount });
});

// Перевод по номеру счёта
router.post('/bank/transfer', (req: any, res) => {
    const userId = req.userId;
    const { accountNumber, amount } = req.body;
    const transferAmount = parseInt(amount);

    if (!accountNumber || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ error: 'Укажите номер счёта и сумму' });
    }

    const sender = db.prepare('SELECT money, accountNumber FROM users WHERE id = ?').get(userId) as any;
    if (!sender) return res.status(404).json({ error: 'User not found' });
    if (sender.money < transferAmount) return res.status(400).json({ error: 'Недостаточно серебра' });

    const target = db.prepare('SELECT id, username, accountNumber FROM users WHERE accountNumber = ?').get(accountNumber) as any;
    if (!target) return res.status(400).json({ error: 'Счёт не найден' });
    if (target.id === userId) return res.status(400).json({ error: 'Нельзя перевести самому себе' });

    db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(transferAmount, userId);
    const commission = Math.ceil(transferAmount * 0.02);
    const receivedAmount = transferAmount - commission;
    db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(receivedAmount, target.id);

    db.prepare(`INSERT INTO transfers (fromUserId, toUserId, fromAccount, toAccount, toUsername, amount, commission, received)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, target.id, sender.accountNumber, target.accountNumber, target.username, transferAmount, commission, receivedAmount);

    const updated = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, message: `Переведено ${receivedAmount} серебра игроку ${target.username} (комиссия ${commission})`, money: updated.money });
});

// История переводов
router.get('/bank/transfers', (req: any, res) => {
    const userId = req.userId;
    const filter = (req.query.filter as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 30;

    let query = 'SELECT * FROM transfers WHERE ';
    if (filter === 'in') query += 'toUserId = ?';
    else if (filter === 'out') query += 'fromUserId = ?';
    else query += '(fromUserId = ? OR toUserId = ?)';

    query += ' ORDER BY id DESC LIMIT ?';
    const params: any[] = filter === 'all' ? [userId, userId, limit] : [userId, limit];

    res.json(db.prepare(query).all(...params));
});

// История банковских операций
router.get('/bank/operations', (req: any, res) => {
    const userId = req.userId;
    const filter = (req.query.filter as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 30;

    let query = 'SELECT * FROM bank_operations WHERE userId = ?';
    if (filter === 'deposit') query += " AND type = 'deposit'";
    else if (filter === 'withdraw') query += " AND type = 'withdraw'";
    query += ' ORDER BY id DESC LIMIT ?';

    res.json(db.prepare(query).all(userId, limit));
});

export default router;
