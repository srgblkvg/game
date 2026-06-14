import { Router } from 'express';
import db from '../database';

const router = Router();

// Публичный эндпоинт — получение действий для главной страницы
router.get('/actions', async (req, res) => {
    const actions = await db.prepare('SELECT * FROM actions_config ORDER BY section, sort_order').all();
    res.json(actions);
});

export default router;
