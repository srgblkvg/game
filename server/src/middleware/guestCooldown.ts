import { Request, Response, NextFunction } from 'express';

// В памяти: userId → timestamp последнего действия
const guestLastAction = new Map<number, number>();
const GUEST_COOLDOWN_MS = 5000; // 5 секунд между действиями

/**
 * Замедляет гостевые запросы — не чаще 1 действия в 5 секунд.
 */
export function guestCooldown(req: any, res: Response, next: NextFunction) {
    if (!req.isGuest) return next();

    const userId = req.userId;
    const now = Date.now();
    const last = guestLastAction.get(userId) || 0;

    if (now - last < GUEST_COOLDOWN_MS) {
        return res.status(429).json({
            error: 'Слишком часто. Гости могут выполнять действия не чаще раза в 5 секунд.',
            retryAfter: Math.ceil((GUEST_COOLDOWN_MS - (now - last)) / 1000),
        });
    }

    guestLastAction.set(userId, now);
    next();
}

// Очистка старых записей раз в минуту
setInterval(() => {
    const cutoff = Date.now() - GUEST_COOLDOWN_MS * 2;
    for (const [id, ts] of guestLastAction) {
        if (ts < cutoff) guestLastAction.delete(id);
    }
}, 60_000);
