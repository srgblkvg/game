"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../../db/index");
const guildWar_1 = require("./guildWar");
const guildQuests_1 = require("./guildQuests");
const events_1 = require("../../events");
const router = (0, express_1.Router)();
router.post('/guild/treasury/deposit', async (req, res) => {
    const userId = req.userId;
    const { amount } = req.body;
    if (!amount || amount < 1)
        return res.status(400).json({ error: 'Укажите сумму (минимум 1 серебра)' });
    const member = await index_1.db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]);
    if (!member)
        return res.status(400).json({ error: 'Вы не в гильдии' });
    // Блокировка казны при войне (pending или active)
    const war = await (0, guildWar_1.isGuildAtWar)(member.guildId);
    if (war)
        return res.status(400).json({ error: 'Казна заморожена на время войны' });
    // Проверяем баланс игрока
    const user = await index_1.db.one('SELECT money FROM users WHERE id = ?', [userId]);
    if (!user || user.money < amount)
        return res.status(400).json({ error: 'Недостаточно серебра в кармане' });
    try {
        const result = await index_1.db.tx(async (client) => {
            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [amount, userId]);
            await client.query('UPDATE guilds SET treasury = treasury + $1 WHERE id = $2', [amount, member.guildId]);
            await client.query('INSERT INTO guild_treasury_log (guildId, userId, amount, createdat) VALUES ($1, $2, $3, $4)', [member.guildId, userId, amount, new Date().toISOString()]);
            const r = await client.query('SELECT treasury FROM guilds WHERE id = $1', [member.guildId]);
            return r.rows[0];
        });
        res.json({ success: true, treasury: result.treasury });
        // Обновляем баланс игрока через WS
        const updatedUser = await index_1.db.one('SELECT money, bank FROM users WHERE id = ?', [userId]);
        if (updatedUser)
            (0, events_1.sendToUser)(userId, { type: 'balance', money: updatedUser.money, bank: updatedUser.bank || 0 });
        // Guild quest progress — track donations
        (0, guildQuests_1.updateGuildQuestProgress)(member.guildId, 'donate', amount).catch(e => console.error('guildQuest donate:', e.message));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// История пополнений казны (с пагинацией, поиском и периодами)
router.get('/guild/treasury/history', async (req, res) => {
    const userId = req.userId;
    const member = await index_1.db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]);
    if (!member)
        return res.status(400).json({ error: 'Вы не в гильдии' });
    const period = req.query.period || 'all'; // today | week | month | all
    let dateFilter = '';
    const now = new Date();
    if (period === 'today') {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        dateFilter = `AND l.createdat >= '${d.toISOString()}'`;
    }
    else if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        dateFilter = `AND l.createdat >= '${d.toISOString()}'`;
    }
    else if (period === 'month') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        dateFilter = `AND l.createdat >= '${d.toISOString()}'`;
    }
    const logs = await index_1.db.query(`
        SELECT l.userid, u.username, SUM(l.amount) as total, COUNT(*) as count
        FROM guild_treasury_log l
        JOIN users u ON l.userid = u.id
        WHERE l.guildid = $1 AND l.userid > 0 ${dateFilter}
        GROUP BY l.userid, u.username
        ORDER BY total DESC
    `, [member.guildId]);
    const treasury = (await index_1.db.one('SELECT treasury FROM guilds WHERE id = ?', [member.guildId]))?.treasury || 0;
    res.json({ treasury, contributions: logs, period });
});
// --- Гильд-войны ---
router.post('/guild/tax-rate', async (req, res) => {
    const userId = req.userId;
    const { taxRate } = req.body;
    if (taxRate == null || taxRate < 0 || taxRate > 50)
        return res.status(400).json({ error: 'Ставка от 0 до 50%' });
    const member = await index_1.db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]);
    if (!member || member.rank !== 'leader')
        return res.status(400).json({ error: 'Только лидер может менять налог' });
    await index_1.db.run('UPDATE guilds SET taxRate = ? WHERE id = ?', [taxRate, member.guildId]);
    res.json({ success: true, taxRate });
});
// ==================== Задания гильдии ====================
exports.default = router;
//# sourceMappingURL=guildTreasury.js.map