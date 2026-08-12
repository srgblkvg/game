import { Router } from 'express';
import { db } from '../db/index';
import { getReserves, updateReserves, getSellCoef, calcBuyCost, calcSellPayout } from '../game/exchange';
import { getTreasury } from '../game/treasury';
import { sendToUser } from '../events';

const router = Router();

const COMMISSION = 0.05; // 5% комиссия сжигается

// Статус биржи: резервы, курс, коэффициенты
router.get('/exchange/status', async (_req, res) => {
    try {
        const reserves = await getReserves();
        const treasury = await getTreasury();
        const basePrice = reserves.gold > 0 ? reserves.silver / reserves.gold : 0;
        const sellCoef = getSellCoef(treasury);

        res.json({
            silver: reserves.silver,
            gold: reserves.gold,
            basePrice: Math.round(basePrice),
            sellPrice: Math.round(basePrice * sellCoef * (1 - COMMISSION)),
            buyPrice: Math.round(basePrice / (1 - COMMISSION)), // approximate
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
    const { goldAmount } = req.body; // сколько золота хочет купить

    if (!goldAmount || goldAmount <= 0) {
        return res.status(400).json({ error: 'Укажите количество золота' });
    }

    const reserves = await getReserves();
    if (goldAmount >= reserves.gold) {
        return res.status(400).json({ error: 'Недостаточно золота в резерве биржи' });
    }

    const user = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // AMM: dy серебра за dx золота
    const rawCost = calcBuyCost(goldAmount, reserves.silver, reserves.gold);
    const totalCost = Math.ceil(rawCost * (1 + COMMISSION)); // +5% комиссия
    const commission = totalCost - Math.ceil(rawCost);

    if (user.money < totalCost) {
        return res.status(400).json({ error: `Недостаточно серебра. Нужно ${totalCost.toLocaleString()}, есть ${(user.money || 0).toLocaleString()}` });
    }

    // Атомарно: списать серебро, начислить золото, обновить резервы
    await db.run('UPDATE users SET money = money - ?, gold = gold + ? WHERE id = ?', [totalCost, goldAmount, userId]);
    await updateReserves(totalCost - commission, -goldAmount); // комиссия сжигается (не идёт в резерв)

    const newReserves = await getReserves();
    res.json({
        success: true,
        goldReceived: goldAmount,
        silverPaid: totalCost,
        commission,
        newGoldBalance: (user.gold || 0) + goldAmount,
        newSilverBalance: user.money - totalCost,
        reserves: newReserves,
    });
});

// Продать золото за серебро
router.post('/exchange/sell', async (req, res) => {
    const userId = req.userId;
    const { goldAmount } = req.body;

    if (!goldAmount || goldAmount <= 0) {
        return res.status(400).json({ error: 'Укажите количество золота' });
    }

    const treasury = await getTreasury();
    const sellCoef = getSellCoef(treasury);
    if (sellCoef <= 0) {
        return res.status(400).json({ error: 'Продажа золота временно недоступна (недостаточно серебра в казне)' });
    }

    const user = await db.one('SELECT money, gold FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if ((user.gold || 0) < goldAmount) {
        return res.status(400).json({ error: `Недостаточно золота. Есть ${user.gold || 0}, хотите продать ${goldAmount}` });
    }

    const reserves = await getReserves();
    const rawPayout = calcSellPayout(goldAmount, reserves.silver, reserves.gold);
    const payout = Math.floor(rawPayout * sellCoef * (1 - COMMISSION));

    if (reserves.silver < payout) {
        return res.status(400).json({ error: 'В казне недостаточно серебра для выкупа' });
    }

    // Атомарно
    await db.run('UPDATE users SET gold = gold - ?, money = money + ? WHERE id = ?', [goldAmount, payout, userId]);
    await updateReserves(-payout, goldAmount);

    const newReserves = await getReserves();
    res.json({
        success: true,
        goldSold: goldAmount,
        silverReceived: payout,
        sellCoef,
        newGoldBalance: (user.gold || 0) - goldAmount,
        newSilverBalance: (user.money || 0) + payout,
        reserves: newReserves,
    });
});

export default router;
