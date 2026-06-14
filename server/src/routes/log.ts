import { Router } from 'express';
import { db } from '../db/index';
import logger from '../logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// История PvE-боёв (требует авторизации)
router.get('/pve-battles', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const battles = await db.query(
        'SELECT * FROM pve_battles WHERE userId = ? ORDER BY createdAt DESC LIMIT ?',
        [userId, limit]
    );
    res.json(battles);
});

// История турниров игрока
router.get('/tournament-history', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const tournaments = await db.query(`
        SELECT t.*, tp.snapshotStats
        FROM tournament_participants tp
        JOIN tournaments t ON tp.tournamentId = t.id
        WHERE tp.userId = ? AND t.status IN ('completed', 'cancelled')
        ORDER BY t.id DESC LIMIT ?
    `, [userId, limit]);

    // Добавляем топ-3 победителей для каждого турнира
    const result = await Promise.all(tournaments.map(async (t: any) => {
        const top3 = await db.query(`
            SELECT u.username, g.name as guildName, tp.snapshotStats
            FROM tournament_participants tp
            JOIN users u ON tp.userId = u.id
            LEFT JOIN guilds g ON u.guildId = g.id
            WHERE tp.tournamentId = ? AND tp.snapshotStats IS NOT NULL
            ORDER BY (tp.snapshotStats::jsonb->>'place')::int
            LIMIT 3
        `, [t.id]);
        return { ...t, top3: top3.map((p: any) => ({ 
            username: p.username, 
            guildName: p.guildName,
            ...(p.snapshotStats ? JSON.parse(p.snapshotStats) : {})
        })) };
    }));

    res.json(result);
});

// История квестов
router.get('/quest-history', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 30;
    res.json(await db.query(
        'SELECT * FROM quest_history WHERE userId = ? ORDER BY id DESC LIMIT ?',
        [userId, limit]
    ));
});

// Приём клиентских ошибок
router.post('/log/error', async (req, res) => {
    const { message, stack, url, line, col, userAgent } = req.body;
    logger.error(`[CLIENT] ${message || 'Unknown error'} ${JSON.stringify({ url, line, col, ua: userAgent, userId: req.userId })}`);
    res.json({ ok: true });
});

export default router;
