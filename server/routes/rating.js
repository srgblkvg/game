"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRank = getRank;
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Звания по ELO
function getRank(elo) {
    if (elo >= 2100)
        return { name: 'Смерть', icon: '👑', color: '#ff4040' };
    if (elo >= 1900)
        return { name: 'Вечность', icon: '♦♦♦', color: '#20c0c0' };
    if (elo >= 1700)
        return { name: 'Бездна', icon: '♦♦', color: '#c02020' };
    if (elo >= 1500)
        return { name: 'Погибель', icon: '♦', color: '#c08020' };
    if (elo >= 1300)
        return { name: 'Кошмар', icon: '▪▪▪', color: '#7b208b' };
    if (elo >= 1100)
        return { name: 'Кровь', icon: '▪▪', color: '#8b3030' };
    if (elo >= 900)
        return { name: 'Тень', icon: '▪', color: '#5a5a8b' };
    if (elo >= 600)
        return { name: 'Шёпот', icon: '•••', color: '#6b8b6b' };
    if (elo >= 300)
        return { name: 'Кость', icon: '••', color: '#a09080' };
    return { name: 'Пепел', icon: '•', color: '#6b6b6b' };
}
// Рейтинг игроков (по ELO)
router.get('/rating', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const minElo = parseInt(req.query.minElo) || 0;
    const maxElo = parseInt(req.query.maxElo) || 0;
    const minLevel = parseInt(req.query.minLevel) || 0;
    const maxLevel = parseInt(req.query.maxLevel) || 0;
    const skip = parseInt(req.query.skip) || 0;
    const offset = (page - 1) * limit + skip;
    let whereClause = 'WHERE u.id > 0';
    const params = [];
    if (search) {
        whereClause += ' AND u.username ILIKE ?';
        params.push(`%${search}%`);
    }
    if (minElo > 0) {
        whereClause += ' AND u.elo >= ?';
        params.push(minElo);
    }
    if (maxElo > 0) {
        whereClause += ' AND u.elo <= ?';
        params.push(maxElo);
    }
    if (minLevel > 0) {
        whereClause += ' AND u.level >= ?';
        params.push(minLevel);
    }
    if (maxLevel > 0) {
        whereClause += ' AND u.level <= ?';
        params.push(maxLevel);
    }
    const total = (await index_1.db.one(`SELECT COUNT(*) as cnt FROM users u ${whereClause}`, params)).cnt;
    const users = await index_1.db.query(`
        SELECT u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses, u.avatar, u.gender, g.name as guildName, u.guildId, u.faction
        FROM users u
        LEFT JOIN guilds g ON u.guildId = g.id
        ${whereClause}
        ORDER BY u.elo DESC
        LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    const result = users.map((u) => ({
        ...u,
        elo: u.elo || 1000,
        rank: getRank(u.elo || 1000),
    }));
    // Include user's own page for auto-navigation
    let myPage = 1;
    if (req.userId) {
        const userRow = await index_1.db.one('SELECT elo FROM users WHERE id = ?', [req.userId]);
        if (userRow) {
            const elo = userRow.elo || 1000;
            const pos = (await index_1.db.one(`SELECT COUNT(*) as cnt FROM users u ${whereClause} AND (u.elo > ? OR (u.elo = ? AND u.id < ?))`, [...params, elo, elo, req.userId])).cnt + 1;
            myPage = Math.ceil(pos / limit);
        }
    }
    res.json({ users: result, total, myPage });
});
// Позиция текущего игрока в рейтинге
router.get('/my-position', async (req, res) => {
    const userId = req.userId;
    if (!userId)
        return res.status(401).json({ error: 'Не авторизован' });
    const user = await index_1.db.one('SELECT elo FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Игрок не найден' });
    const elo = user.elo || 1000;
    const position = (await index_1.db.one('SELECT COUNT(*) as cnt FROM users WHERE id > 0 AND isGuest = 0 AND (elo > ? OR (elo = ? AND id < ?))', [elo, elo, userId])).cnt + 1;
    res.json({ position });
});
exports.default = router;
//# sourceMappingURL=rating.js.map