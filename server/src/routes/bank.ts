import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

router.use('/bank', requireFullAccess);

// Получить состояние банка
router.get('/bank', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT money, bank, accountNumber FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ pocket: user.money || 0, bank: user.bank || 0, accountNumber: user.accountNumber });
});

// Положить в банк
router.post('/bank/deposit', (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const commission = Math.ceil(amount * 0.02);
    const depositAmount = amount - commission;

    const txn = db.transaction(() => {
        const user = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
        if (!user) throw new Error('User not found');
        if (user.money < amount) throw new Error('Недостаточно монет');

        db.prepare('UPDATE users SET money = money - ?, bank = bank + ? WHERE id = ?').run(amount, depositAmount, userId);
        db.prepare('INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES (?, ?, ?, ?, ?)').run(userId, 'deposit', amount, commission, depositAmount);

        return db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    });

    try {
        const updated = txn();
        res.json({ success: true, pocket: updated.money, bank: updated.bank, commission, deposited: depositAmount });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Снять из банка
router.post('/bank/withdraw', (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const txn = db.transaction(() => {
        const user = db.prepare('SELECT bank FROM users WHERE id = ?').get(userId) as any;
        if (!user) throw new Error('User not found');
        if (user.bank < amount) throw new Error('Недостаточно монет в банке');

        db.prepare('UPDATE users SET money = money + ?, bank = bank - ? WHERE id = ?').run(amount, amount, userId);
        db.prepare('INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES (?, ?, ?, ?, ?)').run(userId, 'withdraw', amount, 0, amount);

        return db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    });

    try {
        const updated = txn();
        res.json({ success: true, pocket: updated.money, bank: updated.bank, withdrawn: amount });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Перевод по номеру счёта
router.post('/bank/transfer', (req: any, res) => {
    const userId = req.userId;
    const { accountNumber, amount } = req.body;
    const transferAmount = parseInt(amount);

    if (!accountNumber || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ error: 'Укажите номер счёта и сумму' });
    }

    const txn = db.transaction(() => {
        // Проверяем существование получателя ДО списания
        const target = db.prepare('SELECT id, username, accountNumber FROM users WHERE accountNumber = ?').get(accountNumber) as any;
        if (!target) throw new Error('Счёт не найден');
        if (target.id === userId) throw new Error('Нельзя перевести самому себе');

        // Проверяем и списываем с банка отправителя
        const sender = db.prepare('SELECT bank, accountNumber FROM users WHERE id = ?').get(userId) as any;
        if (!sender) throw new Error('User not found');
        if (sender.bank < transferAmount) throw new Error('Недостаточно серебра в банке');

        const commission = Math.ceil(transferAmount * 0.02);
        const receivedAmount = transferAmount - commission;

        db.prepare('UPDATE users SET bank = bank - ? WHERE id = ?').run(transferAmount, userId);
        db.prepare('UPDATE users SET bank = bank + ? WHERE id = ?').run(receivedAmount, target.id);

        db.prepare('INSERT INTO transfers (fromUserId, toUserId, fromAccount, toAccount, toUsername, amount, commission, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(userId, target.id, sender.accountNumber, target.accountNumber, target.username, transferAmount, commission, receivedAmount);

        const updated = db.prepare('SELECT bank FROM users WHERE id = ?').get(userId) as any;
        return { updated, target, commission, receivedAmount };
    });

    try {
        const { updated, target, commission, receivedAmount } = txn();
        res.json({ success: true, message: `Переведено ${receivedAmount} серебра игроку ${target.username} (комиссия ${commission})`, bank: updated.bank });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
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
