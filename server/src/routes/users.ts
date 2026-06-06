import { Router } from 'express';
import db from '../database';
import { getBaseStats, enrichEquipment } from '../db/helpers';
import { currentStats } from '../game/stats';

const router = Router();

// Поиск пользователя по логину
router.get('/character/username/:username', (req: any, res) => {
    const { username } = req.params;
    const user = db.prepare(
        'SELECT id, username, level FROM users WHERE LOWER(username) = LOWER(?)'
    ).get(username);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});

// Публичный профиль игрока
router.get('/character/public/:userId', (req: any, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

    const user: any = db.prepare(
        'SELECT id, username, level, totalBattles, wins, equipment, currentHp, gender, baseS, baseA, baseD, baseM, pveTotalBattles, pveWins, tournamentCount, tournamentWins, totalJobMoney, totalPveMoneyWon, totalPvpMoneyWon, totalPveMoneyLost, totalPvpMoneyLost, totalJobSeconds, craftCreated, craftUpgraded, craftBroken, createdAt FROM users WHERE id = ?'
    ).get(userId);

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { enriched: enrichedEquipment } = enrichEquipment(db, user.equipment ? JSON.parse(user.equipment) : {});
    const base = getBaseStats(user);
    const stats = currentStats(base, enrichedEquipment);

    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        totalBattles: user.totalBattles,
        wins: user.wins,
        pveTotalBattles: user.pveTotalBattles || 0,
        pveWins: user.pveWins || 0,
        tournamentCount: (db.prepare(
            "SELECT COUNT(*) as cnt FROM tournament_participants tp JOIN tournaments t ON tp.tournamentId = t.id WHERE tp.userId = ? AND t.status = 'completed'"
        ).get(userId) as any).cnt || 0,
        tournamentWins: user.tournamentWins || 0,
        totalJobMoney: user.totalJobMoney || 0,
        totalPveMoneyWon: user.totalPveMoneyWon || 0,
        totalPvpMoneyWon: user.totalPvpMoneyWon || 0,
        totalPveMoneyLost: user.totalPveMoneyLost || 0,
        totalPvpMoneyLost: user.totalPvpMoneyLost || 0,
        totalJobSeconds: user.totalJobSeconds || 0,
        craftCreated: user.craftCreated || 0,
        craftUpgraded: user.craftUpgraded || 0,
        craftBroken: user.craftBroken || 0,
        createdAt: user.createdAt,
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
