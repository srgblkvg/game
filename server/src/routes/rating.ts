import { Router } from 'express';
import db from '../database';

const router = Router();

// Рейтинг игроков (по победам)
router.get('/rating', (req: any, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt;
    const users = db.prepare(`
        SELECT id, username, level, wins
        FROM users
        ORDER BY wins DESC, level DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({ users, total });
});

export default router;
