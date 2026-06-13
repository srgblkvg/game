import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

// router.use('/bank', requireFullAccess); // отключено для гостей

// Получить состояние банка
router.get('/bank', async (req: any, res) => {
    const userId = req.userId;
    const user = await db.prepareGet('SELECT money, bank, accountNumber FROM users WHERE id = ?')(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ pocket: user.money || 0, bank: user.bank || 0, accountNumber: user.accountNumber });
});

// Положить в банк
router.post('/bank/deposit', async (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const commission = Math.ceil(amount * 0.02);
    const depositAmount = amount - commission;

    const txn = db.transaction(async () => {
        const user = await db.prepareGet('SELECT money FROM users WHERE id = ?')(userId) as any;
        if (!user) throw new Error('User not found');
        if (user.money < amount) throw new Error('Недостаточно монет');

        await db.prepareRun('UPDATE users SET money = money - ?, bank = bank + ? WHERE id = ?')(amount, depositAmount, userId);
        await db.prepareRun('INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES (?, ?, ?, ?, ?)')(userId, 'deposit', amount, commission, depositAmount);

        return await db.prepareGet('SELECT money, bank FROM users WHERE id = ?')(userId) as any;
    });

    try {
        const updated = txn();
        res.json({ success: true, pocket: updated.money, bank: updated.bank, commission, deposited: depositAmount });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Снять из банка
router.post('/bank/withdraw', async (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const txn = db.transaction(async () => {
        const user = await db.prepareGet('SELECT bank FROM users WHERE id = ?')(userId) as any;
        if (!user) throw new Error('User not found');
        if (user.bank < amount) throw new Error('Недостаточно монет в банке');

        await db.prepareRun('UPDATE users SET money = money + ?, bank = bank - ? WHERE id = ?')(amount, amount, userId);
        await db.prepareRun('INSERT INTO bank_operations (userId, type, amount, commission, result) VALUES (?, ?, ?, ?, ?)')(userId, 'withdraw', amount, 0, amount);

        return await db.prepareGet('SELECT money, bank FROM users WHERE id = ?')(userId) as any;
    });

    try {
        const updated = txn();
        res.json({ success: true, pocket: updated.money, bank: updated.bank, withdrawn: amount });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Перевод по номеру счёта
router.post('/bank/transfer', async (req: any, res) => {
    const userId = req.userId;
    const { accountNumber, amount } = req.body;
    const transferAmount = parseInt(amount);

    if (!accountNumber || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ error: 'Укажите номер счёта и сумму' });
    }

    const txn = db.transaction(async () => {
        // Проверяем существование получателя ДО списания
        const target = await db.prepareGet('SELECT id, username, accountNumber FROM users WHERE accountNumber = ?')(accountNumber) as any;
        if (!target) throw new Error('Счёт не найден');
        if (target.id === userId) throw new Error('Нельзя перевести самому себе');

        // Проверяем и списываем с банка отправителя
        const sender = await db.prepareGet('SELECT bank, accountNumber FROM users WHERE id = ?')(userId) as any;
        if (!sender) throw new Error('User not found');
        if (sender.bank < transferAmount) throw new Error('Недостаточно серебра в банке');

        const commission = Math.ceil(transferAmount * 0.02);
        const receivedAmount = transferAmount - commission;

        await db.prepareRun('UPDATE users SET bank = bank - ? WHERE id = ?')(transferAmount, userId);
        await db.prepareRun('UPDATE users SET bank = bank + ? WHERE id = ?')(receivedAmount, target.id);

        await db.prepareRun('INSERT INTO transfers (fromUserId, toUserId, fromAccount, toAccount, toUsername, amount, commission, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')(userId, target.id, sender.accountNumber, target.accountNumber, target.username, transferAmount, commission, receivedAmount);

        const updated = await db.prepareGet('SELECT bank FROM users WHERE id = ?')(userId) as any;
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
router.get('/bank/transfers', async (req: any, res) => {
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
router.get('/bank/operations', async (req: any, res) => {
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
