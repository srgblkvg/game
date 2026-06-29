// server/src/routes/arena.ts
import { Router } from 'express';
import { db } from '../db/index';
import { arenaEnterSchema } from '../validation';
import { getBaseStats, enrichEquipment, spendMoney, USER_ARENA_FIELDS_GUILD, buildPlayerStats } from '../db/helpers';

const router = Router();

// Получить случайного соперника (без боя)
router.get('/arena/opponent', async (req, res) => {
    const userId = req.userId;
    const change = req.query.change === 'true';
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : undefined;
    const difficulty = (req.query.difficulty as string) || 'equal'; // easy | equal | hard

    const user: any = await db.one(`SELECT ${USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?`, [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);

    // Если не смена — проверяем закреплённого соперника
    if (!change && user.arenaOpponentId) {
        const saved = await db.one(`SELECT ${USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ? AND (u.protectionUntil IS NULL OR u.protectionUntil < ?) AND (u.guildId IS NULL OR u.guildId != ?)`, [user.arenaOpponentId, now, user.guildId || 0]) as any;
        if (saved) {
            // Проверяем, соответствует ли сохранённый соперник запрошенной сложности
            const matchesDifficulty =
                (difficulty === 'easy' && saved.level >= user.level - 2 && saved.level < user.level) ||
                (difficulty === 'hard' && saved.level > user.level && saved.level <= user.level + 2) ||
                (difficulty === 'equal' && saved.level === user.level);

            if (matchesDifficulty) {
                // Возвращаем того же соперника — бесплатно
                const savedBase = { s: saved.baseS ?? 5, a: saved.baseA ?? 5, d: saved.baseD ?? 5, m: saved.baseM ?? 5 };
                const savedEquip = JSON.parse(saved.equipment || '{}');
                const { enriched: savedEnriched } = await enrichEquipment(savedEquip);
                const savedStats = await buildPlayerStats(saved, 'arena');
                return res.json({
                    id: saved.id, name: saved.username, level: saved.level,
                    equipment: savedEnriched, stats: savedStats,
                    playerMoney: user.money,
                    gender: saved.gender || 'male',
                    avatar: saved.avatar || null,
                    guildName: saved.guildName || null, guildId: saved.guildId || null,
                });
            }
            // Сложность изменилась — сбрасываем сохранённого соперника, ниже подберём нового (с оплатой)
            if (user.money < 10) {
                return res.status(400).json({ error: 'Недостаточно монет для смены сложности (10 бронзы)' });
            }
            await db.run('UPDATE users SET money = money - 10 WHERE id = ?', [userId]);
            user.money -= 10;
        }
        // Соперник исчез (удалён/защита) — сбрасываем и подбираем нового ниже
    }

    // Подбор соперников по сложности
    let opponents = await db.query(
        `SELECT ${USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id != ? AND u.id > 0 AND (u.protectionUntil IS NULL OR u.protectionUntil < ?) AND (u.guildId IS NULL OR u.guildId != ?)`,
        [userId, now, user.guildId || 0]
    ) as any[];

    const diffLabel = difficulty === 'easy' ? `на −2..−1 уровня` : difficulty === 'hard' ? `на +1..+2 уровня` : 'равным вашему';
    if (difficulty === 'easy') {
        opponents = opponents.filter((o: any) => o.level >= user.level - 2 && o.level < user.level);
    } else if (difficulty === 'hard') {
        opponents = opponents.filter((o: any) => o.level > user.level && o.level <= user.level + 2);
    } else {
        opponents = opponents.filter((o: any) => o.level === user.level);
    }

    if (opponents.length === 0) {
        return res.status(404).json({ error: `Нет соперников с уровнем ${diffLabel} (${user.level})` });
    }

    if (excludeId !== undefined && !isNaN(excludeId)) {
        opponents = opponents.filter((o: any) => o.id !== excludeId);
    }

    if (change) {
        if (opponents.length === 0) {
            return res.status(400).json({ error: 'Нет других соперников' });
        }
        if (user.money < 10) {
            return res.status(400).json({ error: 'Недостаточно монет для смены (10 бронзы)' });
        }
        await db.run('UPDATE users SET money = money - 10 WHERE id = ?', [userId]);
        user.money -= 10;
    }

    if (opponents.length === 0) {
        return res.status(404).json({ error: 'Нет доступных соперников' });
    }

    const opponent = opponents[Math.floor(Math.random() * opponents.length)];

    // Запоминаем выбранного соперника
    await db.run('UPDATE users SET arenaOpponentId = ? WHERE id = ?', [opponent.id, userId]);

    const { enriched: enrichedEquipment } = await enrichEquipment(JSON.parse(opponent.equipment || '{}'));
    const stats = await buildPlayerStats(opponent, 'arena');

    res.json({
        id: opponent.id,
        name: opponent.username,
        level: opponent.level,
        equipment: enrichedEquipment,
        stats,
        playerMoney: user.money,
        gender: opponent.gender || 'male',
        avatar: opponent.avatar || null,
        guildName: opponent.guildName || null,
        guildId: opponent.guildId || null,
    });
});

// Вход на арену (платный)
router.post('/arena/enter', async (req, res) => {
    const parsed = arenaEnterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректный запрос' });

    const userId = req.userId;
    const user = await db.one('SELECT money, guildId FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < 10) return res.status(400).json({ error: 'Недостаточно монет (нужно 10 бронзы)' });

    const now = Math.floor(Date.now() / 1000);
    const count = (await db.one(
        'SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?) AND (guildId IS NULL OR guildId != ?)',
        [userId, now, user.guildId || 0]
    ) as any).cnt;
    if (count === 0) return res.status(400).json({ error: 'Нет доступных соперников' });

    await db.run('UPDATE users SET money = money - 10 WHERE id = ?', [userId]);
    res.json({ success: true });
});

// Проверка наличия соперников
router.get('/arena/check-opponent', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    const now = Math.floor(Date.now() / 1000);
    const count = (await db.one(
        'SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?) AND (guildId IS NULL OR guildId != ?)',
        [userId, now, user?.guildId || 0]
    ) as any).cnt;
    if (count === 0) return res.status(404).json({ error: 'Нет доступных соперников' });
    res.json({ available: true });
});

export default router;
