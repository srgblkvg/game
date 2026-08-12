import { Router } from 'express';
import { db } from '../db/index';
import { getGoldReserve, updateGoldReserve, getSellCoef, calcBuyCost, calcSellPayout } from '../game/exchange';
import { getTreasury, addToTreasury, deductFromTreasury } from '../game/treasury';
import { sendToUser } from '../events';

const router = Router();
const COMMISSION = 0.05;

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

    const R_silver = await getTreasury();
    const R_gold = await getGoldReserve();
    if (goldAmount >= R_gold) return res.status(400).json({ error: 'Недостаточно золота в резерве' });

    const user = await db.one('SELECT money, gold FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const rawCost = calcBuyCost(goldAmount, R_silver, R_gold);
    const totalCost = Math.ceil(rawCost * (1 + COMMISSION));

    if ((user.money || 0) < totalCost) {
        return res.status(400).json({ error: `Недостаточно серебра. Нужно ${totalCost.toLocaleString()}` });
    }

    // Серебро → в казну, золото ← из резерва, комиссия сжигается
    await db.run('UPDATE users SET money = money - ?, gold = gold + ? WHERE id = ?', [totalCost, goldAmount, userId]);
    await addToTreasury(totalCost, 'exchange_buy');
    await updateGoldReserve(-goldAmount);

    res.json({
        success: true, goldReceived: goldAmount, silverPaid: totalCost,
        newGold: (user.gold || 0) + goldAmount, newSilver: (user.money || 0) - totalCost,
    });
});

// Продать золото за серебро
router.post('/exchange/sell', async (req, res) => {
    const userId = req.userId;
    const goldAmount = parseInt(req.body.goldAmount) || 0;
    if (goldAmount <= 0) return res.status(400).json({ error: 'Укажите количество золота' });

    const R_silver = await getTreasury();
    const sellCoef = getSellCoef(R_silver);
    if (sellCoef <= 0) return res.status(400).json({ error: 'Продажа золота недоступна (мало серебра в казне)' });

    const user = await db.one('SELECT money, gold FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404);
    if ((user.gold || 0) < goldAmount) return res.status(400).json({ error: 'Недостаточно золота' });

    const R_gold = await getGoldReserve();
    const rawPayout = calcSellPayout(goldAmount, R_silver, R_gold);
    const payout = Math.floor(rawPayout * sellCoef * (1 - COMMISSION));

    if (R_silver < payout) return res.status(400).json({ error: 'В казне недостаточно серебра' });

    // Золото → в резерв, серебро ← из казны
    await db.run('UPDATE users SET gold = gold - ?, money = money + ? WHERE id = ?', [goldAmount, payout, userId]);
    await deductFromTreasury(payout, 'exchange_sell');
    await updateGoldReserve(goldAmount);

    res.json({
        success: true, goldSold: goldAmount, silverReceived: payout,
        newGold: (user.gold || 0) - goldAmount, newSilver: (user.money || 0) + payout,
    });
});

export default router;
