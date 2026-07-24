import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

const COOLDOWN_MS = 60 * 60 * 1000; // 1 час

const STAT_MULTIPLIERS: Record<string, number> = {
    d: 1.0,   // Защита
    a: 1.2,   // Ловкость
    m: 1.5,   // Мастерство
    s: 1.8,   // Сила
};

const STAT_COLUMNS: Record<string, string> = {
    d: 'based',
    a: 'basea',
    m: 'basem',
    s: 'bases',
};

const TRAINED_COLUMNS: Record<string, string> = {
    d: 'trained_d',
    a: 'trained_a',
    m: 'trained_m',
    s: 'trained_s',
};

const STAT_LABELS: Record<string, string> = {
    s: 'Сила',
    a: 'Ловкость',
    d: 'Защита',
    m: 'Мастерство',
};

// Статус тренировки
router.get('/training', async (req, res) => {
    const userId = req.userId;
    const user = await db.one(
        'SELECT level, money, based, basea, basem, bases, trained_s, trained_a, trained_d, trained_m, training_at FROM users WHERE id = ?',
        [userId]
    ) as any;

    const now = Date.now();
    const trainingAt = user.training_at ? new Date(user.training_at).getTime() : 0;
    const cooldownUntil = trainingAt + COOLDOWN_MS;
    const onCooldown = cooldownUntil > now;

    // Стоимость от счётчика тренировок (не от базовых статов)
    const trainedValues = { s: user.trained_s, a: user.trained_a, d: user.trained_d, m: user.trained_m };
    const costs: Record<string, number> = {};
    for (const stat of ['s', 'a', 'd', 'm']) {
        const trained = trainedValues[stat as keyof typeof trainedValues] || 0;
        costs[stat] = Math.floor(10 * Math.pow(trained + 1, 3) * STAT_MULTIPLIERS[stat]!);
    }

    res.json({
        level: user.level,
        money: user.money,
        onCooldown,
        cooldownUntil: onCooldown ? Math.floor(cooldownUntil / 1000) : 0,
        costs,
        stats: {
            s: user.bases,
            a: user.basea,
            d: user.based,
            m: user.basem,
        },
    });
});

// Тренировать стат
router.post('/training', async (req, res) => {
    const userId = req.userId;
    const stat = req.body.stat as string;

    if (!stat || !['s', 'a', 'd', 'm'].includes(stat)) {
        return res.status(400).json({ error: 'Выберите стат: s/a/d/m' });
    }

    const user = await db.one(
        'SELECT level, money, based, basea, basem, bases, trained_s, trained_a, trained_d, trained_m, training_at FROM users WHERE id = ?',
        [userId]
    ) as any;

    // Проверить кулдаун
    const trainingAt = user.training_at ? new Date(user.training_at).getTime() : 0;
    if (Date.now() - trainingAt < COOLDOWN_MS) {
        const remaining = Math.ceil((trainingAt + COOLDOWN_MS - Date.now()) / 60000);
        return res.status(400).json({
            error: `Тренировки выматывают, нужно отдохнуть (ещё ${remaining} мин.)`,
        });
    }

    // Стоимость от счётчика тренировок
    const trainedCol = TRAINED_COLUMNS[stat]!;
    const trained = (user as any)[trainedCol] || 0;
    const cost = Math.floor(10 * Math.pow(trained + 1, 3) * STAT_MULTIPLIERS[stat]!);

    if (user.money < cost) {
        return res.status(400).json({ error: `Недостаточно серебра (нужно ${cost})` });
    }

    const baseColumn = STAT_COLUMNS[stat]!;
    const label = STAT_LABELS[stat]!;

    const now = new Date().toISOString();
    await db.run(
        `UPDATE users SET ${baseColumn} = ${baseColumn} + 1, ${trainedCol} = ${trainedCol} + 1, money = money - ?, training_at = ? WHERE id = ?`,
        [cost, now, userId]
    );

    const updated = await db.one(
        `SELECT ${baseColumn} as new_val FROM users WHERE id = ?`,
        [userId]
    ) as any;

    res.json({
        success: true,
        stat,
        label,
        newValue: updated.new_val,
        cost,
        message: `${label} +1!`,
    });
});

export default router;
