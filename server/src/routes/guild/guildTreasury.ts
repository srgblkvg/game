import { Router } from "express";
import { db } from "../../db/index";
import { isGuildAtWar } from "./guildWar";
import { updateGuildQuestProgress } from "./guildQuests";
import { sendToUser } from "../../events";

const router = Router();

router.post('/guild/treasury/deposit', async (req, res) => {
    const userId = req.userId;
    const { amount } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Укажите сумму (минимум 1 серебра)' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    // Блокировка казны при войне (pending или active)
    const war = await isGuildAtWar(member.guildId);
    if (war) return res.status(400).json({ error: 'Казна заморожена на время войны' });

    // Проверяем баланс игрока
    const user = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;
    if (!user || user.money < amount) return res.status(400).json({ error: 'Недостаточно серебра в кармане' });

    try {
        const result = await db.tx(async (client) => {
            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [amount, userId]);
            await client.query('UPDATE guilds SET treasury = treasury + $1 WHERE id = $2', [amount, member.guildId]);
            await client.query('INSERT INTO guild_treasury_log (guildId, userId, amount, createdat) VALUES ($1, $2, $3, $4)', [member.guildId, userId, amount, new Date().toISOString()]);
            const r = await client.query('SELECT treasury FROM guilds WHERE id = $1', [member.guildId]);
            return r.rows[0];
        });
        res.json({ success: true, treasury: result.treasury });
        // Обновляем баланс игрока через WS
        const updatedUser = await db.one('SELECT money, bank FROM users WHERE id = ?', [userId]) as any;
        if (updatedUser) sendToUser(userId, { type: 'balance', money: updatedUser.money, bank: updatedUser.bank || 0 });
        // Guild quest progress — track donations
        updateGuildQuestProgress(member.guildId).catch(e => console.error('guildQuest donate:', e.message));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// История пополнений казны (с пагинацией, поиском и периодами)
router.get('/guild/treasury/history', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const period = (req.query.period as string) || 'all'; // today | week | month | all

    let dateFilter = '';
    const now = new Date();
    if (period === 'today') {
        const d = new Date(now); d.setHours(0,0,0,0);
        dateFilter = `AND l.createdat >= '${d.toISOString()}'`;
    } else if (period === 'week') {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        dateFilter = `AND l.createdat >= '${d.toISOString()}'`;
    } else if (period === 'month') {
        const d = new Date(now); d.setMonth(d.getMonth() - 1);
        dateFilter = `AND l.createdat >= '${d.toISOString()}'`;
    }

    const logs = await db.query(`
        SELECT l.userid, u.username, SUM(l.amount) as total, COUNT(*) as count
        FROM guild_treasury_log l
        JOIN users u ON l.userid = u.id
        WHERE l.guildid = $1 AND l.userid > 0 ${dateFilter}
        GROUP BY l.userid, u.username
        ORDER BY total DESC
    `, [member.guildId]);

    const treasury = (await db.one('SELECT treasury FROM guilds WHERE id = ?', [member.guildId]) as any)?.treasury || 0;
    res.json({ treasury, contributions: logs, period });
});

// --- Гильд-войны ---

router.post('/guild/tax-rate', async (req, res) => {
    const userId = req.userId;
    const { taxRate } = req.body;
    if (taxRate == null || taxRate < 0 || taxRate > 50) return res.status(400).json({ error: 'Ставка от 0 до 50%' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять налог' });

    await db.run('UPDATE guilds SET taxRate = ? WHERE id = ?', [taxRate, member.guildId]);
    res.json({ success: true, taxRate });
});

// ==================== Задания гильдии ====================


export default router;
