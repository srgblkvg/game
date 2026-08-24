import { Router } from 'express';
import { db } from '../db/index';
import { requireFullAccess } from '../middleware/auth';
import { sendToUser } from '../events';
import { depositWithClient, transferWithClient } from '../game/bankOperations';


const router = Router();

function getOperationId(value: unknown): string | null {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(value) ? value : null;
}

// router.use('/bank', requireFullAccess); // отключено для гостей

// Получить состояние банка
router.get('/bank', async (req, res) => {
    const userId = req.userId;
    let user = await db.one('SELECT money, bank, accountNumber FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Авто-генерация номера счёта, если ещё нет
    if (!user.accountNumber) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let accNum = '';
        for (let i = 0; i < 6; i++) accNum += chars[Math.floor(Math.random() * chars.length)];
        await db.run('UPDATE users SET accountNumber = ? WHERE id = ?', [accNum, userId]);
        user.accountNumber = accNum;
    }

    res.json({ pocket: user.money || 0, bank: user.bank || 0, accountNumber: user.accountNumber });
});

// Положить в банк
router.post('/bank/deposit', async (req, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    try {
        const updated = await db.tx(client => depositWithClient(client, userId, amount));
        res.json({ success: true, pocket: updated.money, bank: updated.bank, commission: updated.commission, deposited: updated.deposited });
        sendToUser(userId, { type: 'balance', money: updated.money, bank: updated.bank });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Снять из банка
router.post('/bank/withdraw', async (req, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });
    const operationId = getOperationId(req.body.operationId);
    if (!operationId) return res.status(400).json({ error: 'Обновите страницу банка и повторите операцию' });

    try {
        const updated = await db.tx(async (client) => {
            const user = (await client.query('SELECT money, bank FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0] as any;
            if (!user) throw new Error('User not found');

            const previous = (await client.query(
                `SELECT id, amount FROM bank_operations
                 WHERE userid = $1 AND type = 'withdraw' AND operationid = $2`,
                [userId, operationId],
            )).rows[0];
            if (previous) return { ...user, withdrawn: previous.amount, duplicate: true };

            if (user.bank < amount) throw new Error(`Недостаточно серебра в банке. Нужно ${amount}, есть ${user.bank}`);

            await client.query('UPDATE users SET money = money + $1, bank = bank - $2 WHERE id = $3', [amount, amount, userId]);
            await client.query(
                'INSERT INTO bank_operations (userId, type, amount, commission, result, operationId) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, 'withdraw', amount, 0, amount, operationId],
            );

            return (await client.query('SELECT money, bank FROM users WHERE id = $1', [userId])).rows[0] as any;
        });
        res.json({ success: true, pocket: updated.money, bank: updated.bank, withdrawn: updated.withdrawn ?? amount, duplicate: updated.duplicate === true });
        if (!updated.duplicate) sendToUser(userId, { type: 'balance', money: updated.money, bank: updated.bank });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Перевод по номеру счёта
router.post('/bank/transfer', async (req, res) => {
    const userId = req.userId;
    const { accountNumber, amount } = req.body;
    const transferAmount = parseInt(amount);

    if (!accountNumber || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ error: 'Укажите номер счёта и сумму' });
    }

    try {
        const result = await db.tx(client => transferWithClient(client, userId, accountNumber, transferAmount));
        res.json({ success: true, message: `Переведено ${result.receivedAmount} серебра игроку ${result.targetUsername} (комиссия ${result.commission})`, bank: result.bank });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// История переводов
router.get('/bank/transfers', async (req, res) => {
    const userId = req.userId;
    const filter = (req.query.filter as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 30;

    let query = 'SELECT * FROM transfers WHERE ';
    if (filter === 'in') query += 'toUserId = ?';
    else if (filter === 'out') query += 'fromUserId = ?';
    else query += '(fromUserId = ? OR toUserId = ?)';
    query += ' ORDER BY id DESC LIMIT ?';
    const params: any[] = filter === 'all' ? [userId, userId, limit] : [userId, limit];

    const result = await db.query(query, params);
    res.json(result.map((r: any) => ({
        ...r,
        createdAt: typeof r.createdAt === 'string' && /^\d+$/.test(r.createdAt) ? Number(r.createdAt) : (r.createdAt ? Math.floor(new Date(r.createdAt).getTime() / 1000) : r.createdAt)
    })));
});

// История банковских операций
router.get('/bank/operations', async (req, res) => {
    const userId = req.userId;
    const filter = (req.query.filter as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 30;

    let query = 'SELECT * FROM bank_operations WHERE userId = ?';
    if (filter === 'deposit') query += " AND type = 'deposit'";
    else if (filter === 'withdraw') query += " AND type = 'withdraw'";
    query += ' ORDER BY id DESC LIMIT ?';

    const result2 = await db.query(query, [userId, limit]);
    res.json(result2.map((r: any) => ({
        ...r,
        createdAt: typeof r.createdAt === 'string' && /^\d+$/.test(r.createdAt) ? Number(r.createdAt) : (r.createdAt ? Math.floor(new Date(r.createdAt).getTime() / 1000) : r.createdAt)
    })));
});

export default router;
