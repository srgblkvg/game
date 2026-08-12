"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const logger_1 = __importDefault(require("../logger"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// История PvE-боёв (требует авторизации)
router.get('/pve-battles', auth_1.authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const battles = await index_1.db.query('SELECT * FROM pve_battles WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [userId, limit]);
    res.json(battles);
});
// История турниров игрока
router.get('/tournament-history', auth_1.authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const tournaments = await index_1.db.query(`
        SELECT t.*, tp.snapshotStats, t.completedAt
        FROM tournament_participants tp
        JOIN tournaments t ON tp.tournamentId = t.id
        WHERE tp.userId = ? AND t.status IN ('completed', 'cancelled')
        ORDER BY t.id DESC LIMIT ?
    `, [userId, limit]);
    // Добавляем топ-3 победителей для каждого турнира
    const result = await Promise.all(tournaments.map(async (t) => {
        const top3 = await index_1.db.query(`
            SELECT u.username, g.name as guildName, tp.snapshotStats
            FROM tournament_participants tp
            JOIN users u ON tp.userId = u.id
            LEFT JOIN guilds g ON u.guildId = g.id
            WHERE tp.tournamentId = ? AND tp.snapshotStats IS NOT NULL
            ORDER BY (tp.snapshotStats::jsonb->>'place')::int
            LIMIT 3
        `, [t.id]);
        return { ...t, top3: top3.map((p) => ({
                username: p.username,
                guildName: p.guildName,
                ...(p.snapshotStats ? JSON.parse(p.snapshotStats) : {})
            })) };
    }));
    res.json(result);
});
// История квестов
router.get('/quest-history', auth_1.authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 30;
    res.json(await index_1.db.query('SELECT * FROM quest_history WHERE userId = ? ORDER BY id DESC LIMIT ?', [userId, limit]));
});
// История резни
router.get('/massacre-battles', auth_1.authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const battles = await index_1.db.query(`SELECT e.id, e.status, e.created_at, e.gathering_end,
                (SELECT COUNT(*) FROM massacre_participants WHERE event_id = e.id) as participant_count,
                (SELECT COUNT(*) FROM massacre_turns WHERE event_id = e.id) as turn_count,
                (SELECT user_id FROM massacre_participants WHERE event_id = e.id AND alive = TRUE LIMIT 1) as winner_id,
                (SELECT u.username FROM massacre_participants mp JOIN users u ON mp.user_id = u.id WHERE mp.event_id = e.id AND mp.alive = TRUE LIMIT 1) as winner_name,
                EXISTS(SELECT 1 FROM massacre_participants WHERE event_id = e.id AND user_id = ?) as participated
         FROM massacre_events e
         WHERE e.status = 'finished'
         ORDER BY e.id DESC LIMIT ?`, [userId, limit]);
    res.json(battles);
});
// Приём клиентских ошибок
router.post('/log/error', async (req, res) => {
    const { message, stack, url, line, col, userAgent } = req.body;
    logger_1.default.error(`[CLIENT] ${message || 'Unknown error'} ${JSON.stringify({ url, line, col, ua: userAgent, userId: req.userId })}`);
    res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=log.js.map