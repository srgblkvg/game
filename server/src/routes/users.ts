import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
import { getBaseStats, enrichEquipment } from '../db/helpers';

const router = Router();

// Поиск пользователя по нику (для чата)
router.get('/users/find', (req: any, res) => {
    let username = req.query.username as string;
    if (!username) return res.status(400).json({ error: 'username required' });
    if (username.startsWith('@')) {
        username = username.slice(1);
    }
    const user = db.prepare(
        'SELECT id, username, level FROM users WHERE LOWER(username) = LOWER(?)'
    ).get(username);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});

// Публичный профиль игрока
router.get('/character/public/:userId', (req: any, res) => {
    const userId = parseInt(req.params.userId);
    const user: any = db.prepare('SELECT id, username, level, totalBattles, wins, equipment, currentHp, gender, baseS, baseA, baseD, baseM FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const equipment = JSON.parse(user.equipment || '{}');
    const { enriched: enrichedEquipment } = enrichEquipment(db, equipment);
    const base = getBaseStats(user);
    const stats = currentStats(base, enrichedEquipment);

    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        totalBattles: user.totalBattles,
        wins: user.wins,
        equipment: enrichedEquipment,
        stats,
        currentHp: user.currentHp,
        gender: user.gender || 'male',
    });
});

// GET /users/list?ids=1,2,3
router.get('/users/list', (req: any, res) => {
    const idsParam = req.query.ids as string;
    if (!idsParam) return res.json([]);
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const users = db.prepare(`SELECT id, username FROM users WHERE id IN (${placeholders})`).all(...ids);
    res.json(users);
});

export default router;
