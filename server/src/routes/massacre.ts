// server/src/routes/massacre.ts
import { Router } from 'express';
import { db } from '../db/index';
import { buildPlayerStats } from '../db/helpers';
import { pushNotification } from '../events';
import { addToTreasury } from '../game/treasury';

const router = Router();

// --- Состояние текущей резни ---
router.get('/massacre/state', async (req, res) => {
    const userId = req.userId;
    const now = Math.floor(Date.now() / 1000);

    // Найти активное gathering-событие
    let event = await db.one(
        `SELECT * FROM massacre_events WHERE status = 'gathering' ORDER BY id DESC LIMIT 1`,
        []
    ) as any;

    // Если нет активного — создать новое
    if (!event) {
        await db.run(
            `INSERT INTO massacre_events (status, gathering_end) VALUES ('gathering', ?)`,
            [now + 1800]
        );
        event = await db.one(`SELECT * FROM massacre_events WHERE id = (SELECT MAX(id) FROM massacre_events)`, []) as any;
    }

    const participantCount = (await db.one(
        `SELECT COUNT(*) as cnt FROM massacre_participants WHERE event_id = ?`,
        [event.id]
    ) as any).cnt;

    const myPart = await db.one(
        `SELECT COUNT(*) as cnt FROM massacre_participants WHERE event_id = ? AND user_id = ?`,
        [event.id, userId]
    ) as any;

    const timeLeft = Math.max(0, event.gathering_end - now);

    // Если сбор закончился но статус ещё gathering — бой скоро начнётся (scheduler подхватит)
    if (timeLeft <= 0 && event.status === 'gathering') {
        return res.json({
            event: { id: event.id, status: 'starting', entry_fee: event.entry_fee, participant_count: participantCount },
            myParticipation: myPart.cnt > 0,
            timeLeft: 0,
        });
    }

    res.json({
        event: { id: event.id, status: event.status, entry_fee: event.entry_fee, participant_count: participantCount, gathering_end: event.gathering_end },
        myParticipation: myPart.cnt > 0,
        timeLeft,
    });
});

// --- Присоединиться к резне ---
router.post('/massacre/join', async (req, res) => {
    const userId = req.userId;
    const now = Math.floor(Date.now() / 1000);

    const event = await db.one(
        `SELECT * FROM massacre_events WHERE status = 'gathering' AND gathering_end > ? ORDER BY id DESC LIMIT 1`,
        [now]
    ) as any;

    if (!event) {
        return res.status(400).json({ error: 'Нет активной резни' });
    }

    // Проверить что ещё не участвует
    const already = await db.one(
        `SELECT COUNT(*) as cnt FROM massacre_participants WHERE event_id = ? AND user_id = ?`,
        [event.id, userId]
    ) as any;
    if (already.cnt > 0) {
        return res.status(400).json({ error: 'Вы уже в резне' });
    }

    // Загрузить игрока
    const user = await db.one(
        `SELECT id, username, level, baseS, baseA, baseD, baseM, money, currentHp, equipment, activeDrink, drinkUntil, premiumUntil, guildId FROM users WHERE id = ?`,
        [userId]
    ) as any;

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Проверить деньги
    if (user.money < event.entry_fee) {
        return res.status(400).json({ error: `Недостаточно серебра (нужно ${event.entry_fee})` });
    }

    // Получить статы
    const stats = await buildPlayerStats(user, 'arena');

    // Списать деньги
    await db.run('UPDATE users SET money = money - ? WHERE id = ?', [event.entry_fee, userId]);

    // Добавить в казну замка
    await addToTreasury(event.entry_fee, 'massacre');

    // Добавить участника
    await db.run(
        `INSERT INTO massacre_participants (event_id, user_id, level, base_s, base_a, base_d, base_m, hp_current, hp_max)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [event.id, userId, user.level, user.bases, user.basea, user.based, user.basem, stats.hp, stats.hp]
    );

    res.json({ success: true, eventId: event.id });
});

// --- Лог боя ---
router.get('/massacre/log/:eventId', async (req, res) => {
    const userId = req.userId;
    const eventId = parseInt(req.params.eventId);

    const event = await db.one(`SELECT * FROM massacre_events WHERE id = ?`, [eventId]) as any;
    if (!event) return res.status(404).json({ error: 'Событие не найдено' });

    const turns = await db.query(
        `SELECT * FROM massacre_turns WHERE event_id = ? ORDER BY turn_number`,
        [eventId]
    ) as any[];

    const participants = await db.query(
        `SELECT mp.*, u.username FROM massacre_participants mp JOIN users u ON mp.user_id = u.id WHERE mp.event_id = ?`,
        [eventId]
    ) as any[];

    const turnsWithFlag = turns.map(t => ({
        ...t,
        isMyTurn: t.actor_id === userId,
    }));

    res.json({
        event: { id: event.id, status: event.status, participant_count: participants.length },
        participants: participants.map(p => ({ id: p.user_id, name: p.username, level: p.level, alive: p.alive })),
        turns: turnsWithFlag,
    });
});

export default router;
