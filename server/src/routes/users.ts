import { Router } from 'express';
import { db } from '../db/index';
import { getBaseStats, enrichEquipment } from '../db/helpers';
import { currentStats } from '../game/stats';
import { getDrinkBonuses } from '../game/drinks';

const router = Router();

// Поиск пользователя по логину
router.get('/character/username/:username', async (req, res) => {
    const { username } = req.params;
    const user = await db.one(
        'SELECT id, username, level FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
    );
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});

// Публичный профиль игрока
router.get('/character/public/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

    const user: any = await db.one(
        'SELECT u.id, u.username, u.level, u.totalBattles, u.wins, u.equipment, u.currentHp, u.gender, u.avatar, u.baseS, u.baseA, u.baseD, u.baseM, u.pveTotalBattles, u.pveWins, u.tournamentCount, u.tournamentWins, u.totalJobMoney, u.totalPveMoneyWon, u.totalPvpMoneyWon, u.totalPveMoneyLost, u.totalPvpMoneyLost, u.totalJobSeconds, u.craftCreated, u.craftUpgraded, u.craftBroken, u.createdAt, g.name as guildName, u.guildId FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?',
        [userId]
    );

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { enriched: enrichedEquipment } = await enrichEquipment(user.equipment ? JSON.parse(user.equipment) : {});
    const base = getBaseStats(user);
    const collCnt = (await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]) as any).cnt || 0;
    const stats = currentStats(base, enrichedEquipment, getDrinkBonuses(user), collCnt);

    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        totalBattles: user.totalBattles,
        wins: user.wins,
        pveTotalBattles: user.pveTotalBattles || 0,
        pveWins: user.pveWins || 0,
        tournamentCount: (await db.one(
            "SELECT COUNT(*) as cnt FROM tournament_participants tp JOIN tournaments t ON tp.tournamentId = t.id WHERE tp.userId = ? AND t.status = 'completed'",
            [userId]
        ) as any).cnt || 0,
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
        avatar: user.avatar || null,
        guildName: user.guildName || null,
        guildId: user.guildId || null,
    });
});

// GET /users/list?ids=1,2,3
router.get('/users/list', async (req, res) => {
    const idsParam = req.query.ids as string;
    if (!idsParam) return res.json([]);
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const users = await db.query(`SELECT id, username FROM users WHERE id IN (${placeholders})`, ids);
    res.json(users);
});

export default router;
