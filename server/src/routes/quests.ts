import { Router } from 'express';
import { db } from '../db/index';
import { applyExp } from '../db/helpers';
import { markDirty } from '../events';
import { getToday, getSnapshot, getProgress, getMidnightTS, QUEST_INFO, DIFFICULTIES, BASE_REWARDS, QUEST_TYPES, type QuestType, type DiffKey } from '../game/questData';

const router = Router();

// Получить/сгенерировать квесты
router.get('/tavern/quests', async (req, res) => {
    const userId = req.userId;
    const today = await getToday();

    let quests = await db.query(
        'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id',
        [userId, today]
    ) as any[];

    if (quests.length === 0) {
        const now = await getSnapshot(userId);

        // Переносим ВСЕ активные квесты с прошлых дней на сегодня (не только вчера)
        const activeOld = await db.query(
            "SELECT * FROM daily_quests WHERE userId = ? AND date < ? AND status = 'active'",
            [userId, today]
        ) as any[];

        for (const aq of activeOld) {
            await db.run(
                'UPDATE daily_quests SET date = ? WHERE id = ?',
                [today, aq.id]
            );
        }

        // Генерируем недостающие available квесты
        const existingTypes = new Set(activeOld.map((q: any) => q.questType));
        for (const qt of QUEST_TYPES) {
            if (existingTypes.has(qt)) continue;
            const diffs = Object.keys(DIFFICULTIES);
            const diff = diffs[Math.floor(Math.random() * diffs.length)] as DiffKey;
            const d = DIFFICULTIES[diff];
            const req = d.req[qt];
            const rw = BASE_REWARDS[qt];
            await db.run(
                'INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, qt, diff, req, Math.round(rw.xp * d.rewardMult), Math.round(rw.money * d.rewardMult), 'available', JSON.stringify(now), today]
            );
        }

        quests = await db.query(
            'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id',
            [userId, today]
        ) as any[];
    }

    // Обновляем прогресс
    for (const q of quests) {
        if (q.status === 'active') {
            const prog = await getProgress(userId, q.snapshot, q.questType);
            if (prog !== q.progress) {
                await db.run('UPDATE daily_quests SET progress = ? WHERE id = ?', [Math.min(prog, q.requirement), q.id]);
                q.progress = Math.min(prog, q.requirement);
            }
        }
    }

    const activeCount = quests.filter((q: any) => q.status === 'active').length;
    const completedToday = quests.filter((q: any) => q.status === 'claimed').length;
    const canTake = activeCount < 3 && (activeCount + completedToday) < 5;

    res.json({
        quests: quests.filter((q: any) => q.status !== 'claimed').map((q) => {
            const qt = q.questType as QuestType;
            const info = QUEST_INFO[qt];
            return {
                ...q,
                typeName: info.name,
                typeIcon: info.icon,
                description: info.desc(q.requirement, q.difficulty),
                difficultyLabel: DIFFICULTIES[q.difficulty as keyof typeof DIFFICULTIES]?.label || q.difficulty,
                snapshot: undefined,
            };
        }),
        activeCount,
        completedToday,
        canTake,
        dailyLimit: 5,
        maxActive: 3,
        resetAt: await getMidnightTS(),
    });
});

// Взять квест
router.post('/tavern/quests/take', async (req, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId) return res.status(400).json({ error: 'Укажите questId' });

    const quest = await db.one('SELECT * FROM daily_quests WHERE id = ? AND userId = ?', [questId, userId]) as any;
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'available') return res.status(400).json({ error: 'Квест недоступен' });

    const today = await getToday();
    const activeCount = (await db.one(
        "SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND status = 'active' AND date = ?",
        [userId, today]
    ) as any).cnt;
    if (activeCount >= 3) return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });

    const completedToday = (await db.one(
        "SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND date = ? AND status = 'claimed'",
        [userId, today]
    ) as any).cnt;
    if (activeCount + completedToday >= 5) return res.status(400).json({ error: 'Дневной лимит квестов (5) исчерпан' });
    if (activeCount >= 3) return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });

    const snapshot = JSON.stringify(await getSnapshot(userId));
    await db.run('UPDATE daily_quests SET status = ?, snapshot = ?, progress = 0 WHERE id = ?',
        ['active', snapshot, questId]);

    res.json({ success: true });
    // Вместо sendDailyQuestsUpdate — помечаем dirty, serverTick сам отправит
    markDirty(userId, 'quests');
});

// Сдать квест
router.post('/tavern/quests/claim', async (req, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId) return res.status(400).json({ error: 'Укажите questId' });

    const quest = await db.one('SELECT * FROM daily_quests WHERE id = ? AND userId = ?', [questId, userId]) as any;
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'active') return res.status(400).json({ error: 'Квест не активен' });

    const prog = await getProgress(userId, quest.snapshot, quest.questType);
    if (prog < quest.requirement) {
        return res.status(400).json({ error: `Прогресс: ${prog}/${quest.requirement}` });
    }

    await db.run('UPDATE users SET money = money + ? WHERE id = ?',
        [quest.rewardMoney, userId]);

    // Получаем текущие exp/level для applyExp
    const user = await db.one('SELECT exp, level, statPoints FROM users WHERE id = ?', [userId]) as any;
    const { newExp, newLevel, levelsGained, newStatPoints } = await applyExp(userId, quest.rewardXp, user.exp, user.level, user.statPoints || 0);
    await db.run('UPDATE users SET exp = ?, level = ?, statPoints = ? WHERE id = ?',
        [newExp, newLevel, newStatPoints, userId]);

    await db.run('UPDATE daily_quests SET status = ?, progress = ? WHERE id = ?',
        ['claimed', quest.requirement, questId]);

    await db.run('INSERT INTO quest_history (userId, questType, difficulty, typeName, rewardXp, rewardMoney) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, quest.questType, quest.difficulty, QUEST_INFO[quest.questType as QuestType]?.name || quest.questType, quest.rewardXp, quest.rewardMoney]);

    // Выдаём новый квест того же типа со случайной сложностью
    const today = await getToday();
    const diffs = Object.keys(DIFFICULTIES);
    const newDiff = diffs[Math.floor(Math.random() * diffs.length)] as DiffKey;
    const d = DIFFICULTIES[newDiff];
    const newReq = d.req[quest.questType as QuestType];
    const rw = BASE_REWARDS[quest.questType as QuestType];
    await db.run('INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, quest.questType, newDiff, newReq, Math.round(rw.xp * d.rewardMult), Math.round(rw.money * d.rewardMult), 'available', JSON.stringify(await getSnapshot(userId)), today]);

    const updated = await db.one('SELECT money, exp, level, statPoints FROM users WHERE id = ?', [userId]) as any;
    res.json({ success: true, rewardXp: quest.rewardXp, rewardMoney: quest.rewardMoney, money: updated.money, exp: updated.exp, level: updated.level, statPoints: updated.statPoints, levelsGained });
    // Вместо sendDailyQuestsUpdate — dirty-флаг
    markDirty(userId, 'quests');
});

export default router;
