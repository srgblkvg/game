"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const achievements_1 = require("./achievements");
const events_1 = require("../events");
const router = (0, express_1.Router)();
const COOLDOWN_SEC = 60 * 60; // 1 час в секундах
const STAT_MULTIPLIERS = {
    d: 1.0, // Защита
    a: 1.2, // Ловкость
    m: 1.5, // Мастерство
    s: 1.8, // Сила
};
const STAT_COLUMNS = {
    d: 'based',
    a: 'basea',
    m: 'basem',
    s: 'bases',
};
const TRAINED_COLUMNS = {
    d: 'trained_d',
    a: 'trained_a',
    m: 'trained_m',
    s: 'trained_s',
};
const STAT_LABELS = {
    s: 'Сила',
    a: 'Ловкость',
    d: 'Защита',
    m: 'Мастерство',
};
// Статус тренировки
router.get('/training', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT level, money, based, basea, basem, bases, trained_s, trained_a, trained_d, trained_m, training_at FROM users WHERE id = ?', [userId]);
    const now = Date.now();
    const trainingAt = user.training_at ? new Date(user.training_at).getTime() : 0;
    const cooldownUntil = trainingAt + COOLDOWN_SEC * 1000;
    const onCooldown = cooldownUntil > now;
    // Стоимость от счётчика тренировок (не от базовых статов)
    const trainedValues = { s: user.trained_s, a: user.trained_a, d: user.trained_d, m: user.trained_m };
    const costs = {};
    for (const stat of ['s', 'a', 'd', 'm']) {
        const trained = trainedValues[stat] || 0;
        costs[stat] = trained === 0 ? 10 : Math.floor(10 * Math.pow(trained + 1, 3) * STAT_MULTIPLIERS[stat]);
    }
    res.json({
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
    const stat = req.body.stat;
    if (!stat || !['s', 'a', 'd', 'm'].includes(stat)) {
        return res.status(400).json({ error: 'Выберите стат: s/a/d/m' });
    }
    const user = await index_1.db.one('SELECT level, money, based, basea, basem, bases, trained_s, trained_a, trained_d, trained_m, training_at FROM users WHERE id = ?', [userId]);
    // Проверить кулдаун
    const trainingAt = user.training_at ? new Date(user.training_at).getTime() : 0;
    if (Date.now() - trainingAt < COOLDOWN_SEC * 1000) {
        const remaining = Math.ceil((trainingAt + COOLDOWN_SEC * 1000 - Date.now()) / 60000);
        return res.status(400).json({
            error: `Тренировки выматывают, нужно отдохнуть (ещё ${remaining} мин.)`,
        });
    }
    // Стоимость от счётчика тренировок
    const trainedCol = TRAINED_COLUMNS[stat];
    const trained = user[trainedCol] || 0;
    const cost = trained === 0 ? 10 : Math.floor(10 * Math.pow(trained + 1, 3) * STAT_MULTIPLIERS[stat]);
    if (user.money < cost) {
        return res.status(400).json({ error: `Недостаточно серебра (нужно ${cost})` });
    }
    const baseColumn = STAT_COLUMNS[stat];
    const label = STAT_LABELS[stat];
    const now = new Date().toISOString();
    await index_1.db.run(`UPDATE users SET ${baseColumn} = ${baseColumn} + 1, ${trainedCol} = ${trainedCol} + 1, money = money - ?, training_at = ? WHERE id = ?`, [cost, now, userId]);
    (0, achievements_1.checkAchievement)(userId, 'training').catch(() => { });
    const cooldownUntil = Math.floor(Date.now() / 1000) + COOLDOWN_SEC;
    (0, events_1.sendToUser)(userId, { type: 'trainingCooldown', cooldownUntil });
    const updated = await index_1.db.one(`SELECT ${baseColumn} as new_val FROM users WHERE id = ?`, [userId]);
    res.json({
        success: true,
        stat,
        label,
        newValue: updated.new_val,
        cost,
        message: `${label} +1!`,
    });
});
exports.default = router;
//# sourceMappingURL=training.js.map