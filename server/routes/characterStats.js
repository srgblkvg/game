"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Распределение очков статов
router.post('/character/allocate-stats', async (req, res) => {
    const userId = req.userId;
    const { s, a, d, m } = req.body;
    const total = (s || 0) + (a || 0) + (d || 0) + (m || 0);
    if (total <= 0)
        return res.status(400).json({ error: 'Укажите, сколько очков распределить' });
    const user = await index_1.db.one('SELECT statPoints, baseS, baseA, baseD, baseM FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (total > (user.statPoints || 0))
        return res.status(400).json({ error: 'Недостаточно очков' });
    const newS = (user.baseS || 5) + (s || 0);
    const newA = (user.baseA || 5) + (a || 0);
    const newD = (user.baseD || 5) + (d || 0);
    const newM = (user.baseM || 5) + (m || 0);
    const newPoints = (user.statPoints || 0) - total;
    await index_1.db.run('UPDATE users SET baseS = ?, baseA = ?, baseD = ?, baseM = ?, statPoints = ? WHERE id = ?', [newS, newA, newD, newM, newPoints, userId]);
    res.json({ baseS: newS, baseA: newA, baseD: newD, baseM: newM, statPoints: newPoints });
});
// Список названий характеристик
router.get('/stat-names', async (req, res) => {
    const stats = await index_1.db.query('SELECT * FROM stat_names', []);
    res.json(stats);
});
exports.default = router;
//# sourceMappingURL=characterStats.js.map