import { Router } from 'express';
import db from '../database';
import logger from '../logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// История PvE-боёв (требует авторизации)
router.get('/pve-battles', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const battles = db.prepare(
        'SELECT * FROM pve_battles WHERE userId = ? ORDER BY createdAt DESC LIMIT ?'
    ).all(userId, limit);
    res.json(battles);
});

// История турниров игрока
router.get('/tournament-history', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const tournaments = await db.prepare(`
        SELECT t.*, tp.snapshotStats
        FROM tournament_participants tp
        JOIN tournaments t ON tp.tournamentId = t.id
        WHERE tp.userId = ? AND t.status IN ('completed', 'cancelled')
        ORDER BY t.id DESC LIMIT ?
    `).all(userId, limit);

    res.json(tournaments);
});

// История квестов
router.get('/quest-history', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 30;
    res.json(await db.prepare(
        'SELECT * FROM quest_history WHERE userId = ? ORDER BY id DESC LIMIT ?'
    ).all(userId, limit));
});

// Приём клиентских ошибок
router.post('/log/error', async (req, res) => {
    const { message, stack, url, line, col, userAgent } = req.body;
    logger.error(`[CLIENT] ${message || 'Unknown error'} ${JSON.stringify({ url, line, col, ua: userAgent, userId: req.userId })}`);
    res.json({ ok: true });
});

export default router;
