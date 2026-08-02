import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

const FACTIONS = {
    bandit: { name: 'Бандиты', desc: '+10% характеристик против Ремесленников. Диапазон атак ±4 уровня.' },
    crafter: { name: 'Ремесленники', desc: '+10% шанс крафта/улучшения. +100% награда за работы.' },
    guard: { name: 'Стражники', desc: '+10% характеристик против Бандитов и в PvE.' },
} as const;

type Faction = keyof typeof FACTIONS;

// Получить инфо о фракциях и текущую фракцию игрока
router.get('/faction', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT faction, level FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    res.json({
        factions: FACTIONS,
        current: user.faction || null,
        canChoose: (user.level || 0) >= 5 && !user.faction,
    });
});

// Выбрать фракцию
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
        return res.status(400).json({ error: 'Фракция уже выбрана' });
    }

    await db.run('UPDATE users SET faction = ? WHERE id = ?', [faction, userId]);

    res.json({ success: true, faction, ...FACTIONS[faction as Faction] });
});

export { FACTIONS };
export type { Faction };
export default router;
