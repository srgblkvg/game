// server/src/routes/arena.ts
import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
import { arenaEnterSchema } from '../validation';
import { getBaseStats, enrichEquipment, spendMoney } from '../db/helpers';

const router = Router();

// Получить случайного соперника (без боя)
router.get('/arena/opponent', (req: any, res) => {
    const userId = req.userId;
    const change = req.query.change === 'true';
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : undefined;
    const difficulty = (req.query.difficulty as string) || 'equal'; // easy | equal | hard

    const user: any = db.prepare('SELECT u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses, u.equipment, u.baseS, u.baseA, u.baseD, u.baseM, u.inventorySlots, u.lastAttackTime, g.name as guildName, u.guildId FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    let opponents = db.prepare(
        'SELECT u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses, u.equipment, u.baseS, u.baseA, u.baseD, u.baseM, g.name as guildName, u.guildId FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id != ? AND u.id > 0 AND (u.protectionUntil IS NULL OR u.protectionUntil < ?)'
    ).all(userId, now) as any[];

    // Фильтр по сложности
    const diffLabel = difficulty === 'easy' ? 'ниже вашего' : difficulty === 'hard' ? 'выше вашего' : 'равным вашему';
    if (difficulty === 'easy') {
        opponents = opponents.filter((o: any) => o.level < user.level);
    } else if (difficulty === 'hard') {
        opponents = opponents.filter((o: any) => o.level > user.level);
    } else {
        opponents = opponents.filter((o: any) => o.level === user.level);
    }

    if (opponents.length === 0) {
        return res.status(404).json({ error: `Нет соперников с уровнем ${diffLabel} (${user.level})` });
    }

    if (excludeId !== undefined) {
        opponents = opponents.filter((o: any) => o.id !== excludeId);
    }

    if (change) {
        if (opponents.length === 0) {
            return res.status(400).json({ error: 'Нет других соперников' });
        }
        if (user.money < 10) {
            return res.status(400).json({ error: 'Недостаточно монет для смены (10 бронзы)' });
        }
        db.prepare('UPDATE users SET money = money - 10 WHERE id = ?').run(userId);
        user.money -= 10;
    } else {
        if (opponents.length === 0) {
            return res.status(404).json({ error: 'Нет доступных соперников' });
        }
    }

    const opponent = opponents[Math.floor(Math.random() * opponents.length)];
    const base = {
        s: opponent.baseS ?? 5,
        a: opponent.baseA ?? 5,
        d: opponent.baseD ?? 5,
        m: opponent.baseM ?? 5,
    };
    const equipment = JSON.parse(opponent.equipment || '{}');

    // Обогащаем экипировку
    const { enriched: enrichedEquipment } = enrichEquipment(db, equipment);

    const stats = currentStats(base, enrichedEquipment);

    res.json({
        id: opponent.id,
        name: opponent.username,
        level: opponent.level,
        equipment: enrichedEquipment,
        stats,
        playerMoney: user.money,
        gender: opponent.gender || 'male',
        guildName: opponent.guildName || null,
        guildId: opponent.guildId || null,
    });
});

// Вход на арену (платный)
router.post('/arena/enter', (req: any, res) => {
    const parsed = arenaEnterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректный запрос' });

    const userId = req.userId;
    const user = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < 10) return res.status(400).json({ error: 'Недостаточно монет (нужно 10 бронзы)' });

    const now = Math.floor(Date.now() / 1000);
    const count = (db.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)'
    ).get(userId, now) as any).cnt;
    if (count === 0) return res.status(400).json({ error: 'Нет доступных соперников' });

    db.prepare('UPDATE users SET money = money - 10 WHERE id = ?').run(userId);
    res.json({ success: true });
});

// Проверка наличия соперников
router.get('/arena/check-opponent', (req: any, res) => {
    const userId = req.userId;
    const now = Math.floor(Date.now() / 1000);
    const count = (db.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)'
    ).get(userId, now) as any).cnt;
    if (count === 0) return res.status(404).json({ error: 'Нет доступных соперников' });
    res.json({ available: true });
});

export default router;