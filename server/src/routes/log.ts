import { Router } from 'express';
import logger from '../logger';

const router = Router();

// Приём клиентских ошибок (window.onerror, React Error Boundary)
router.post('/log/error', (req: any, res) => {
    const { message, stack, url, line, col, userAgent } = req.body;
    logger.error(`[CLIENT] ${message || 'Unknown error'} ${JSON.stringify({ url, line, col, ua: userAgent, userId: req.userId })}`);
    res.json({ ok: true });
});

export default router;
