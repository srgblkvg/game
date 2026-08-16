import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

router.get('/activity', async (req, res) => {
    const requestedDays = Number(req.query.days || 1);
    const days = Math.max(1, Math.min(30, Number.isFinite(requestedDays) ? requestedDays : 1));
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - days * 86400;
    const onlineCutoff = now - 90;

    const [summary, pages, recent] = await Promise.all([
        db.raw(`
            SELECT
                COUNT(*) FILTER (WHERE last_heartbeat_at >= $1 AND ended_at IS NULL) AS online_sessions,
                COUNT(DISTINCT user_id) FILTER (WHERE last_heartbeat_at >= $1 AND ended_at IS NULL) AS online_users,
                COUNT(DISTINCT user_id) FILTER (WHERE started_at >= $2) AS unique_users,
                COUNT(*) FILTER (WHERE started_at >= $2) AS sessions,
                COALESCE(SUM(active_seconds) FILTER (WHERE started_at >= $2), 0) AS active_seconds,
                COALESCE(AVG(active_seconds) FILTER (WHERE started_at >= $2), 0) AS average_session_seconds,
                COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY active_seconds)
                    FILTER (WHERE started_at >= $2), 0) AS median_session_seconds
            FROM game_sessions
        `, [onlineCutoff, cutoff]),
        db.raw(`
            SELECT path,
                   COUNT(*) AS visits,
                   COUNT(DISTINCT user_id) AS unique_users,
                   COALESCE(SUM(active_seconds), 0) AS active_seconds,
                   COALESCE(AVG(active_seconds) FILTER (WHERE active_seconds > 0), 0) AS average_seconds
            FROM game_page_visits
            WHERE started_at >= $1
            GROUP BY path
            ORDER BY active_seconds DESC, visits DESC
            LIMIT 100
        `, [cutoff]),
        db.raw(`
            SELECT s.user_id, u.username, s.platform, s.started_at,
                   s.last_heartbeat_at, s.active_seconds,
                   p.path
            FROM game_sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN LATERAL (
                SELECT path FROM game_page_visits
                WHERE session_id = s.id ORDER BY id DESC LIMIT 1
            ) p ON TRUE
            WHERE s.last_heartbeat_at >= $1 AND s.ended_at IS NULL
            ORDER BY s.last_heartbeat_at DESC
            LIMIT 100
        `, [onlineCutoff]),
    ]);

    res.json({
        days,
        generatedAt: now,
        summary: summary.rows[0] || {},
        pages: pages.rows,
        online: recent.rows,
    });
});

export default router;
