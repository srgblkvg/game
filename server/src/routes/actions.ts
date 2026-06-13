import { Router } from 'express';
import db from '../database';

const router = Router();

// Публичный эндпоинт — получение действий для главной страницы
router.get('/actions', async (req, res) => {
    const actions = await db.manyOrNone('SELECT * FROM actions_config ORDER BY section, sort_order');
    res.json(actions);
});

export default router;
