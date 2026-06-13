import { Router } from 'express';
import db from '../database';

const router = Router();

// Распределение очков статов
router.post('/character/allocate-stats', (req: any, res) => {
    const userId = req.userId;
    const { s, a, d, m } = req.body;
    const total = (s || 0) + (a || 0) + (d || 0) + (m || 0);
    if (total <= 0) return res.status(400).json({ error: 'Укажите, сколько очков распределить' });

    const user: any = await db.prepareGet('SELECT statPoints, baseS, baseA, baseD, baseM FROM users WHERE id = ?')(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (total > (user.statPoints || 0)) return res.status(400).json({ error: 'Недостаточно очков' });

    const newS = (user.baseS || 5) + (s || 0);
    const newA = (user.baseA || 5) + (a || 0);
    const newD = (user.baseD || 5) + (d || 0);
    const newM = (user.baseM || 5) + (m || 0);
    const newPoints = (user.statPoints || 0) - total;

    await db.prepareRun('UPDATE users SET baseS = ?, baseA = ?, baseD = ?, baseM = ?, statPoints = ? WHERE id = ?')(newS, newA, newD, newM, newPoints, userId);

    res.json({ baseS: newS, baseA: newA, baseD: newD, baseM: newM, statPoints: newPoints });
});

// Список названий характеристик
router.get('/stat-names', (req: any, res) => {
    const stats = await db.prepareAll('SELECT * FROM stat_names')();
    res.json(stats);
});

export default router;
