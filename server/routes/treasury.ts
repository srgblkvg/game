import { Router } from 'express';
import { getTreasury } from '../game/treasury';

const router = Router();

router.get('/treasury', async (_req, res) => {
    const amount = await getTreasury();
    res.json({ amount });
});

export default router;
