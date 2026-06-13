import { Router } from 'express';
import db from '../database';

const router = Router();

// Публичный эндпоинт — получение действий для главной страницы
router.get('/actions', (_req: any, res) => {
    const actions = await db.prepareAll('SELECT * FROM actions_config ORDER BY section, sort_order')();
    res.json(actions);
});

export default router;
