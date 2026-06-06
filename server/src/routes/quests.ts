import { Router } from 'express';
import db from '../database';

const router = Router();

// Настройки квестов
const QUEST_TYPES = ['hunt', 'arena', 'job', 'craft', 'auction'] as const;
type QuestType = typeof QUEST_TYPES[number];

const QUEST_NAMES: Record<QuestType, string> = {
    hunt: 'Крысиный мор', arena: 'Первая кровь', job: 'Медяки в карман',
    craft: 'Проба пера', auction: 'Ставка сделана',
};

const DIFFICULTIES = {
    easy: { label: '⭐ Простой', mult: 1, rewardMult: 1 },
    medium: { label: '⭐⭐ Средний', mult: 5, rewardMult: 1.5 },
    hard: { label: '⭐⭐⭐ Сложный', mult: 25, rewardMult: 2 },
};

const BASE_REQUIREMENTS: Record<QuestType, number> = {
    hunt: 3, arena: 1, job: 1, craft: 1, auction: 1,
};

const BASE_REWARDS: Record<QuestType, { xp: number; money: number }> = {
    hunt: { xp: 3, money: 30 }, arena: { xp: 3, money: 40 },
    job: { xp: 3, money: 20 }, craft: { xp: 3, money: 25 }, auction: { xp: 3, money: 50 },
};

function getSnapshot(userId: number): Record<string, number> {
    const u = db.prepare(
        'SELECT pveTotalBattles, wins, totalBattles, craftCount, auctionTrades FROM users WHERE id = ?'
    ).get(userId) as any;
    return {
        pve: u?.pveTotalBattles || 0,
        pvpWins: u?.wins || 0,
        pvpBattles: u?.totalBattles || 0,
        craft: u?.craftCount || 0,
        auction: u?.auctionTrades || 0,
    };
}

function getCurrentProgress(userId: number, snapshot: any, questType: QuestType): number {
    const u = db.prepare(
        'SELECT pveTotalBattles, wins, totalBattles, craftCount, auctionTrades FROM users WHERE id = ?'
    ).get(userId) as any;
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    switch (questType) {
        case 'hunt': return (u?.pveTotalBattles || 0) - (s.pve || 0);
        case 'arena': return (u?.wins || 0) - (s.pvpWins || 0);
        case 'craft': return (u?.craftCount || 0) - (s.craft || 0);
        case 'auction': return (u?.auctionTrades || 0) - (s.auction || 0);
        case 'job': return (u?.pvpBattles || 0) - (s.pvpBattles || 0); // placeholder, handled separately
        default: return 0;
    }
}

// Для работ используем job_history
function getJobProgress(userId: number, snapshot: any): number {
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    const count = (db.prepare(
        "SELECT COUNT(*) as cnt FROM job_history WHERE userId = ? AND finishedAt > ?"
    ).get(userId, s.jobLastDate || '2000-01-01') as any).cnt;
    return count;
}

// Получить/сгенерировать квесты
router.get('/tavern/quests', (req: any, res) => {
    const userId = req.userId;
    const today = new Date().toISOString().slice(0, 10);

    // Ищем квесты на сегодня
    let quests = db.prepare(
        'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id'
    ).all(userId, today) as any[];

    // Генерируем если нет
    if (quests.length === 0) {
        const stmt = db.prepare(
            'INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const qt of QUEST_TYPES) {
            const diffs = Object.keys(DIFFICULTIES);
            const diff = diffs[Math.floor(Math.random() * diffs.length)];
            const d = DIFFICULTIES[diff as keyof typeof DIFFICULTIES];
            const req = Math.round(BASE_REQUIREMENTS[qt] * d.mult);
            const rw = BASE_REWARDS[qt];
            const snapshot = JSON.stringify(getSnapshot(userId));
            stmt.run(userId, qt, diff, req, Math.round(rw.xp * d.rewardMult), Math.round(rw.money * d.rewardMult), 'available', snapshot, today);
        }
        quests = db.prepare(
            'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id'
        ).all(userId, today) as any[];
    }

    // Обновляем прогресс для активных квестов
    for (const q of quests) {
        if (q.status === 'active') {
            const prog = q.questType === 'job'
                ? getJobProgress(userId, q.snapshot)
                : getCurrentProgress(userId, q.snapshot, q.questType);
            if (prog !== q.progress) {
                db.prepare('UPDATE daily_quests SET progress = ? WHERE id = ?').run(Math.min(prog, q.requirement), q.id);
                q.progress = Math.min(prog, q.requirement);
            }
        }
    }

    const activeCount = quests.filter((q: any) => q.status === 'active').length;
    const completedToday = quests.filter((q: any) => q.status === 'claimed').length;
    const canTake = activeCount < 3 && completedToday < 5;

    res.json({
        quests: quests.map((q: any) => ({
            ...q,
            typeName: QUEST_NAMES[q.questType as QuestType],
            difficultyLabel: DIFFICULTIES[q.difficulty as keyof typeof DIFFICULTIES]?.label || q.difficulty,
            snapshot: undefined, // не отдаём снапшот клиенту
        })),
        activeCount,
        completedToday,
        canTake,
        dailyLimit: 5,
        maxActive: 3,
    });
});

// Взять квест
router.post('/tavern/quests/take', (req: any, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId) return res.status(400).json({ error: 'Укажите questId' });

    const quest = db.prepare('SELECT * FROM daily_quests WHERE id = ? AND userId = ?').get(questId, userId) as any;
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'available') return res.status(400).json({ error: 'Квест недоступен' });

    const activeCount = (db.prepare(
        "SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND status = 'active'"
    ).get(userId) as any).cnt;
    if (activeCount >= 3) return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });

    const completedToday = (db.prepare(
        "SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND date = ? AND status = 'claimed'"
    ).get(userId, new Date().toISOString().slice(0, 10)) as any).cnt;
    if (completedToday >= 5) return res.status(400).json({ error: 'Дневной лимит выполнен' });

    // Обновляем снапшот
    const snapshot = JSON.stringify(getSnapshot(userId));
    db.prepare('UPDATE daily_quests SET status = ?, snapshot = ?, progress = 0 WHERE id = ?')
        .run('active', snapshot, questId);

    res.json({ success: true });
});

// Сдать квест
router.post('/tavern/quests/claim', (req: any, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId) return res.status(400).json({ error: 'Укажите questId' });

    const quest = db.prepare('SELECT * FROM daily_quests WHERE id = ? AND userId = ?').get(questId, userId) as any;
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'active') return res.status(400).json({ error: 'Квест не активен' });

    const prog = quest.questType === 'job'
        ? getJobProgress(userId, quest.snapshot)
        : getCurrentProgress(userId, quest.snapshot, quest.questType);

    if (prog < quest.requirement) {
        return res.status(400).json({ error: `Прогресс: ${prog}/${quest.requirement}` });
    }

    // Выдаём награду
    db.prepare('UPDATE users SET money = money + ?, exp = exp + ? WHERE id = ?')
        .run(quest.rewardMoney, quest.rewardXp, userId);
    db.prepare('UPDATE daily_quests SET status = ?, progress = ? WHERE id = ?')
        .run('claimed', quest.requirement, questId);

    const updated = db.prepare('SELECT money, exp FROM users WHERE id = ?').get(userId) as any;
    res.json({
        success: true,
        rewardXp: quest.rewardXp,
        rewardMoney: quest.rewardMoney,
        money: updated.money,
        exp: updated.exp,
    });
});

export default router;
