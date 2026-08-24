import { Router } from 'express';
import { db } from '../db/index';
import { getGoldReserve, getSellCoef } from '../game/exchange';
import { getTreasury } from '../game/treasury';
import { buyGoldWithClient, sellGoldWithClient } from '../game/exchangeTrade';
import { sendToUser, broadcast } from '../events';
import logger from '../logger';

const router = Router();
const COMMISSION = 0.05;

// История курса
router.get('/exchange/history', async (req, res) => {
    try {
        const period = (req.query.period as string) || '24h';
        const hours = period === '1h' ? 1 : period === '7d' ? 168 : period === '30d' ? 720 : period === 'all' ? 87600 : 24;
        const timeFilter = period === 'all' ? '' : `WHERE created_at > NOW() - INTERVAL '${hours} hours'`;
        const rows = await db.query(
            `SELECT price, silver, gold, EXTRACT(EPOCH FROM created_at)::bigint as timestamp
             FROM exchange_history
             ${timeFilter}
             ORDER BY created_at ASC`,
            []
        ) as any[];
        const current = await getTreasury();
        const currentGold = await getGoldReserve();
        const currentPrice = currentGold > 0 ? Math.round(current / currentGold) : 0;
        res.json({
            data: rows,
            currentPrice,
            currentSilver: current,
            currentGold,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

async function broadcastStatus() {
    const R_silver = await getTreasury();
    const R_gold = await getGoldReserve();
    const basePrice = R_gold > 0 ? Math.round(R_silver / R_gold) : 0;
    const sellCoef = getSellCoef(R_silver);
    broadcast('exchange_status', {
        silver: R_silver, gold: R_gold, basePrice,
        sellPrice: Math.round(basePrice * sellCoef * (1 - COMMISSION)),
        buyPrice: Math.round(basePrice / (1 - COMMISSION)),
        sellCoef, buyCoef: 1,
    });
}

// Статус биржи
router.get('/exchange/status', async (_req, res) => {
    try {
        const R_silver = await getTreasury();
        const R_gold = await getGoldReserve();
        const basePrice = R_gold > 0 ? Math.round(R_silver / R_gold) : 0;
        const sellCoef = getSellCoef(R_silver);

        res.json({
            silver: R_silver,
            gold: R_gold,
            basePrice,
            sellPrice: Math.round(basePrice * sellCoef * (1 - COMMISSION)),
            buyPrice: Math.round(basePrice / (1 - COMMISSION)),
            sellCoef,
            buyCoef: 1,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Купить золото за серебро
router.post('/exchange/buy', async (req, res) => {
    const userId = req.userId;
    const goldAmount = parseInt(req.body.goldAmount) || 0;
    if (goldAmount <= 0) return res.status(400).json({ error: 'Укажите количество золота' });

    const result = await db.tx(client => buyGoldWithClient(client, userId, goldAmount));
    if (!result.ok) return res.status(result.status).json(result.error ? { error: result.error } : undefined);
    res.json(result.body);
    void broadcastStatus().catch(error => logger.error({ error }, 'exchange status broadcast failed'));
});

// Продать золото за серебро
router.post('/exchange/sell', async (req, res) => {
    const userId = req.userId;
    const goldAmount = parseInt(req.body.goldAmount) || 0;
    if (goldAmount <= 0) return res.status(400).json({ error: 'Укажите количество золота' });

    const result = await db.tx(client => sellGoldWithClient(client, userId, goldAmount));
    if (!result.ok) return res.status(result.status).json(result.error ? { error: result.error } : undefined);
    res.json(result.body);
    void broadcastStatus().catch(error => logger.error({ error }, 'exchange status broadcast failed'));
});

export default router;
