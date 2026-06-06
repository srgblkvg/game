import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

// Все маршруты банка требуют полный доступ
router.use('/bank', requireFullAccess);

// Получить состояние банка
router.get('/bank', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT money, bank, lastBankVisit, accountNumber FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const cooldownRemaining = Math.max(0, 1800 - (now - (user.lastBankVisit || 0)));

    res.json({
        pocket: user.money || 0,
        bank: user.bank || 0,
        canVisit: cooldownRemaining === 0,
        cooldownRemaining,
        accountNumber: user.accountNumber,
    });
});

// Положить в банк
router.post('/bank/deposit', (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const now = Math.floor(Date.now() / 1000);
    const user = db.prepare('SELECT money, bank, lastBankVisit FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.lastBankVisit > 0 && (now - user.lastBankVisit) < 1800) {
        const remaining = 1800 - (now - user.lastBankVisit);
        return res.status(400).json({ error: `Банк недоступен. Ждите ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    if (user.money < amount) return res.status(400).json({ error: 'Недостаточно монет' });

    const commission = Math.ceil(amount * 0.02);
    const depositAmount = amount - commission;

    db.prepare('UPDATE users SET money = money - ?, bank = bank + ?, lastBankVisit = ? WHERE id = ?')
        .run(amount, depositAmount, now, userId);

    const updated = db.prepare('SELECT money, bank FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, pocket: updated.money, bank: updated.bank, commission, deposited: depositAmount });
});

// Снять из банка
router.post('/bank/withdraw', (req: any, res) => {
    const userId = req.userId;
    const amount = parseInt(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });

    const now = Math.floor(Date.now() / 1000);
    const user = db.prepare('SELECT money, bank, lastBankVisit FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.lastBankVisit > 0 && (now - user.lastBankVisit) < 1800) {
        const remaining = 1800 - (now - user.lastBankVisit);
        return res.status(400).json({ error: `Банк недоступен. Ждите ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    if (user.bank < amount) return res.status(400).json({ error: 'Недостаточно монет в банке' });

    db.prepare('UPDATE users SET money = money + ?, bank = bank - ?, lastBankVisit = ? WHERE id = ?')
        .run(amount, amount, now, userId);

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

    const sender = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    if (!sender) return res.status(404).json({ error: 'User not found' });
    if (sender.money < transferAmount) return res.status(400).json({ error: 'Недостаточно серебра' });

    const target = db.prepare('SELECT id, username FROM users WHERE accountNumber = ?').get(accountNumber) as any;
    if (!target) return res.status(400).json({ error: 'Счёт не найден' });
    if (target.id === userId) return res.status(400).json({ error: 'Нельзя перевести самому себе' });

    db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(transferAmount, userId);
    db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(transferAmount, target.id);

    const updated = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, message: `Переведено ${transferAmount} серебра игроку ${target.username}`, money: updated.money });
});

export default router;
