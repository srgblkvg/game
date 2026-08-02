import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

const FACTIONS = {
    bandit: { name: 'Бандиты', desc: '+10% характеристик против Ремесленников. Атаки ±4 уровня. Репутация: +1% к доходу PvP за 100 побед. Таймер атаки ×2 быстрее.' },
    crafter: { name: 'Ремесленники', desc: '+10% шанс крафта/улучшения +1% за 1000 крафтов. +100% награда за работы.' },
    guard: { name: 'Стражники', desc: '+10% характеристик против Бандитов и в PvE. Карма и жалование до +100%.' },
} as const;

type Faction = keyof typeof FACTIONS;

const CHANGE_COST = 10000;

// Получить инфо о фракциях и текущую фракцию игрока
router.get('/faction', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT faction, level, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Количество участников по фракциям
    const counts = await db.query('SELECT faction, COUNT(*) as cnt FROM users WHERE faction IS NOT NULL GROUP BY faction') as any[];
    const memberCounts: Record<string, number> = { bandit: 0, crafter: 0, guard: 0 };
    for (const row of counts) {
        if (memberCounts.hasOwnProperty(row.faction)) memberCounts[row.faction] = Number(row.cnt);
    }

    res.json({
        factions: FACTIONS,
        current: user.faction || null,
        canChoose: (user.level || 0) >= 5 && !user.faction,
        memberCounts,
        changeCost: CHANGE_COST,
        canChange: !!user.faction && user.money >= CHANGE_COST,
    });
});

// Выбрать фракцию (первый раз — бесплатно)
router.post('/faction/choose', async (req, res) => {
    const userId = req.userId;
    const { faction } = req.body;

    if (!faction || !FACTIONS[faction as Faction]) {
        return res.status(400).json({ error: 'Неизвестная фракция. Доступны: bandit, crafter, guard' });
    }

    const user = await db.one('SELECT faction, level FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if ((user.level || 0) < 5) {
        return res.status(400).json({ error: 'Нужен 5 уровень для выбора фракции' });
    }

    if (user.faction) {
        return res.status(400).json({ error: 'Фракция уже выбрана. Используйте /api/faction/change для смены.' });
    }

    await db.run('UPDATE users SET faction = ? WHERE id = ?', [faction, userId]);

    res.json({ success: true, faction, ...FACTIONS[faction as Faction] });
});

// Сменить фракцию (платно)
router.post('/faction/change', async (req, res) => {
    const userId = req.userId;
    const { faction } = req.body;

    if (!faction || !FACTIONS[faction as Faction]) {
        return res.status(400).json({ error: 'Неизвестная фракция. Доступны: bandit, crafter, guard' });
    }

    const user = await db.one('SELECT faction, level, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (!user.faction) {
        return res.status(400).json({ error: 'У вас ещё нет фракции. Используйте /api/faction/choose.' });
    }

    if (user.faction === faction) {
        return res.status(400).json({ error: 'Вы уже состоите в этой фракции' });
    }

    if (user.money < CHANGE_COST) {
        return res.status(400).json({ error: `Недостаточно серебра. Нужно ${CHANGE_COST.toLocaleString()}.` });
    }

    await db.run(
        'UPDATE users SET faction = ?, money = money - ?, karma = 0, faction_craft_count = 0, bandit_reputation = 0 WHERE id = ?',
        [faction, CHANGE_COST, userId]
    );

    res.json({ success: true, faction, cost: CHANGE_COST, ...FACTIONS[faction as Faction] });
});

export { FACTIONS };
export type { Faction };
export default router;
