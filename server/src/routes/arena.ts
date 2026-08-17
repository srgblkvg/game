// server/src/routes/arena.ts
import { Router } from 'express';
import { db } from '../db/index';
import { arenaEnterSchema } from '../validation';
import { getBaseStats, enrichEquipment, spendMoney, USER_ARENA_FIELDS_GUILD, buildPlayerStats, buildCombatPowerStats } from '../db/helpers';
import { applyHpRegen } from '../game/hpRegen';
import { calculateCombatPower } from '../game/combatPower';

const router = Router();
const MIN_BATTLE_HP_RATIO = 0.2;

async function getArenaHp(user: any): Promise<{ currentHp: number; maxHp: number }> {
    const stats = await buildPlayerStats(user, 'arena');
    const currentHp = await applyHpRegen({
        id: user.id,
        currentHp: user.currentHp ?? user.currenthp ?? stats.hp,
        maxHp: stats.hp,
        lastHpUpdate: user.lastHpUpdate ?? user.lasthpupdate ?? 0,
        roomType: user.roomType ?? user.roomtype,
        roomUntil: user.roomUntil ?? user.roomuntil,
        premiumUntil: user.premiumUntil ?? user.premiumuntil,
    });
    return { currentHp, maxHp: stats.hp };
}

async function hasEnoughHpForBattle(user: any): Promise<boolean> {
    const hp = await getArenaHp(user);
    return hp.currentHp >= hp.maxHp * MIN_BATTLE_HP_RATIO;
}

async function getArenaCombatPower(user: any): Promise<number> {
    return calculateCombatPower(await buildCombatPowerStats(user), undefined, Number(user.level));
}

// Получить случайного соперника (без боя)
router.get('/arena/opponent', async (req, res) => {
    const userId = req.userId;
    const change = req.query.change === 'true';
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : undefined;
    const difficulty = (req.query.difficulty as string) || 'equal'; // easy | equal | hard

    const user: any = await db.one(`SELECT ${USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?`, [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    if (!await hasEnoughHpForBattle(user)) {
        return res.status(400).json({ error: 'Для участия в PvP необходимо не менее 20% здоровья' });
    }

    // Если не смена — проверяем закреплённого соперника
    if (!change && user.arenaOpponentId) {
        const saved = await db.one(`SELECT ${USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ? AND (u.protectionUntil IS NULL OR u.protectionUntil < ?) AND (u.guildId IS NULL OR u.guildId != ?)`, [user.arenaOpponentId, now, user.guildId || 0]) as any;
        if (saved && await hasEnoughHpForBattle(saved)) {
            // Проверяем, соответствует ли сохранённый соперник запрошенной сложности
            const range = user.faction === 'bandit' ? 4 : 2;
            const matchesDifficulty =
                (difficulty === 'easy' && saved.level >= user.level - range && saved.level < user.level) ||
                (difficulty === 'hard' && saved.level > user.level && saved.level <= user.level + range) ||
                (difficulty === 'equal' && saved.level === user.level);

            if (matchesDifficulty) {
                // Возвращаем того же соперника — бесплатно
                const savedBase = { s: saved.baseS ?? 5, a: saved.baseA ?? 5, d: saved.baseD ?? 5, m: saved.baseM ?? 5 };
                const savedEquip = JSON.parse(saved.equipment || '{}');
                const { enriched: savedEnriched } = await enrichEquipment(savedEquip);
                const savedStats = await buildPlayerStats(saved, 'arena');
                const savedHp = await getArenaHp(saved);
                const savedCombatPower = await getArenaCombatPower(saved);
                return res.json({
                    id: saved.id, name: saved.username, level: saved.level,
                    equipment: savedEnriched, stats: savedStats,
                    combatPower: savedCombatPower,
                    currentHp: savedHp.currentHp,
                    playerMoney: user.money,
                    gender: saved.gender || 'male',
                    avatar: saved.avatar || null,
                    faction: saved.faction || null,
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

    const range = user.faction === 'bandit' ? 4 : 2;
    const diffLabel = difficulty === 'easy' ? `на −${range}..−1 уровня` : difficulty === 'hard' ? `на +1..+${range} уровня` : 'равным вашему';
    if (difficulty === 'easy') {
        opponents = opponents.filter((o: any) => o.level >= user.level - range && o.level < user.level);
    } else if (difficulty === 'hard') {
        opponents = opponents.filter((o: any) => o.level > user.level && o.level <= user.level + range);
    } else {
        opponents = opponents.filter((o: any) => o.level === user.level);
    }

    // Тяжело раненые игроки не участвуют в подборе соперников.
    const hpEligibility = await Promise.all(opponents.map(hasEnoughHpForBattle));
    opponents = opponents.filter((_opponent, index) => hpEligibility[index]);

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
    const combatPower = await getArenaCombatPower(opponent);

    // Актуальное HP с офлайн-регеном
    const { currentHp: actualHp } = await getArenaHp(opponent);

    res.json({
        id: opponent.id,
        name: opponent.username,
        level: opponent.level,
        equipment: enrichedEquipment,
        stats,
        combatPower,
        currentHp: actualHp,
        playerMoney: user.money,
        gender: opponent.gender || 'male',
        avatar: opponent.avatar || null,
        faction: opponent.faction || null,
        guildName: opponent.guildName || null,
        guildId: opponent.guildId || null,
    });
});

// Вход на арену (платный)
router.post('/arena/enter', async (req, res) => {
    const parsed = arenaEnterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректный запрос' });

    const userId = req.userId;
    const user = await db.one(`SELECT ${USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?`, [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!await hasEnoughHpForBattle(user)) {
        return res.status(400).json({ error: 'Для участия в PvP необходимо не менее 20% здоровья' });
    }
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
