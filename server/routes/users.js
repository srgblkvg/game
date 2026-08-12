"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const helpers_1 = require("../db/helpers");
const guildBuildings_1 = require("../game/guildBuildings");
const router = (0, express_1.Router)();
// Поиск пользователя по логину
router.get('/character/username/:username', async (req, res) => {
    const { username } = req.params;
    const user = await index_1.db.one('SELECT id, username, level FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});
// Публичный профиль игрока
router.get('/character/public/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid userId' });
    const user = await index_1.db.one('SELECT u.id, u.username, u.level, u.totalBattles, u.wins, u.equipment, u.currentHp, u.gender, u.avatar, u.baseS, u.baseA, u.baseD, u.baseM, u.pveTotalBattles, u.pveWins, u.tournamentCount, u.tournamentWins, u.totalJobMoney, u.totalPveMoneyWon, u.totalPvpMoneyWon, u.totalPveMoneyLost, u.totalPvpMoneyLost, u.totalJobSeconds, u.craftCreated, u.craftUpgraded, u.craftBroken, u.createdAt, u.casino_games_played, u.casino_won, u.casino_lost, g.name as guildName, u.guildId FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    const guildBonus = await (0, guildBuildings_1.getGuildBonus)(userId, 'arena');
    const { enriched: enrichedEquipment } = await (0, helpers_1.enrichEquipment)(user.equipment ? JSON.parse(user.equipment) : {});
    const stats = await (0, helpers_1.buildPlayerStats)(user, 'arena');
    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        totalBattles: user.totalBattles,
        wins: user.wins,
        pveTotalBattles: user.pveTotalBattles || 0,
        pveWins: user.pveWins || 0,
        tournamentCount: (await index_1.db.one("SELECT COUNT(*) as cnt FROM tournament_participants tp JOIN tournaments t ON tp.tournamentId = t.id WHERE tp.userId = ? AND t.status = 'completed'", [userId])).cnt || 0,
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
        // Резня
        massacreParticipations: (await index_1.db.one('SELECT COUNT(*) as cnt FROM massacre_participants WHERE user_id = ?', [userId])).cnt || 0,
        massacreWins: (await index_1.db.one(`SELECT COUNT(*) as cnt FROM massacre_participants mp
             JOIN massacre_events me ON mp.event_id = me.id
             WHERE mp.user_id = ? AND mp.alive = TRUE AND me.status = 'finished'`, [userId])).cnt || 0,
        // Аукцион
        auctionBought: (await index_1.db.one('SELECT COUNT(*) as cnt FROM auction_history WHERE buyerid = ?', [userId])).cnt || 0,
        auctionSold: (await index_1.db.one('SELECT COUNT(*) as cnt FROM auction_history WHERE sellerid = ?', [userId])).cnt || 0,
        // Казино
        casinoGamesPlayed: user.casino_games_played || 0,
        casinoWon: user.casino_won || 0,
        casinoLost: user.casino_lost || 0,
    });
});
// GET /users/list?ids=1,2,3
router.get('/users/list', async (req, res) => {
    const idsParam = req.query.ids;
    if (!idsParam)
        return res.json([]);
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0)
        return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const users = await index_1.db.query(`SELECT id, username FROM users WHERE id IN (${placeholders})`, ids);
    res.json(users);
});
// Онлайн пользователи (замена WebSocket) — последние 5 минут активности
router.get('/users/online', async (req, res) => {
    try {
        const cutoff = Math.floor(Date.now() / 1000) - 300;
        const users = await index_1.db.query('SELECT id, username, level FROM users WHERE lastAction > ? ORDER BY username LIMIT 50', [cutoff]);
        res.json(users);
    }
    catch {
        res.json([]);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map