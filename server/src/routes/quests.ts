import { Router } from 'express';
import db from '../database';

const router = Router();

const QUEST_TYPES = ['hunt', 'arena', 'job', 'craft', 'auction'] as const;
type QuestType = typeof QUEST_TYPES[number];

const QUEST_INFO: Record<QuestType, { name: string; icon: string; desc: (req: number, diff: string) => string }> = {
    hunt: { name: 'Крысиный мор', icon: '🗡️', desc: (r, d) => `Убить ${r} мобов` },
    arena: { name: 'Первая кровь', icon: '⚔️', desc: (r, d) => `Одержать ${r} PvP-побед` },
    job: { name: 'Медяки в карман', icon: '🌍', desc: (r, d) => {
        if (d === 'easy') return 'Провести 10 минут на работах';
        if (d === 'medium') return 'Провести 1 час на работах';
        return 'Провести 4 часа на работах';
    }},
    craft: { name: 'Проба пера', icon: '⚒️', desc: (r, d) => `Создать или улучшить ${r} предметов` },
    auction: { name: 'Ставка сделана', icon: '💰', desc: (r, d) => `Совершить ${r} сделок на аукционе` },
};

const DIFFICULTIES = {
    easy:   { label: '⭐ Простой',    rewardMult: 1,   req: { hunt: 3,    arena: 1,  job: 600,  craft: 1, auction: 1 } } as const,
    medium: { label: '⭐⭐ Средний',   rewardMult: 1.5, req: { hunt: 15,   arena: 5,  job: 3600, craft: 3, auction: 3 } } as const,
    hard:   { label: '⭐⭐⭐ Сложный',  rewardMult: 2,   req: { hunt: 75,   arena: 25, job: 14400,craft: 6, auction: 6 } } as const,
} as const;

type DiffKey = keyof typeof DIFFICULTIES;

const BASE_REWARDS: Record<QuestType, { xp: number; money: number }> = {
    hunt: { xp: 3, money: 30 }, arena: { xp: 3, money: 40 },
    job: { xp: 3, money: 20 }, craft: { xp: 3, money: 25 }, auction: { xp: 3, money: 50 },
};

function getToday(): string {
    return new Date().toISOString().slice(0, 10);
}

function getMidnightTS(): number {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

async function getSnapshot(userId: number): Record<string, number> {
    const u = await db.prepare(
        'SELECT pveWins, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?'
    ).get(userId) as any;
    return {
        pve: u?.pveWins || 0,
        pvpWins: u?.wins || 0,
        craft: u?.craftCount || 0,
        auction: u?.auctionTrades || 0,
        jobSec: u?.totalJobSeconds || 0,
    };
}

async function getProgress(userId: number, snapshot: any, questType: QuestType): number {
    const u = await db.prepare(
        'SELECT pveWins, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?'
    ).get(userId) as any;
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    switch (questType) {
        case 'hunt': return (u?.pveWins || 0) - (s.pve || 0);
        case 'arena': return (u?.wins || 0) - (s.pvpWins || 0);
        case 'craft': return (u?.craftCount || 0) - (s.craft || 0);
        case 'auction': return (u?.auctionTrades || 0) - (s.auction || 0);
        case 'job': return (u?.totalJobSeconds || 0) - (s.jobSec || 0);
        default: return 0;
    }
}

// Получить/сгенерировать квесты
router.get('/tavern/quests', async (req, res) => {
    const userId = req.userId;
    const today = getToday();

    let quests = await db.prepare(
        'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id'
    ).all(userId, today) as any[];

    if (quests.length === 0) {
        const now = getSnapshot(userId);

        // Переносим активные квесты со вчера на сегодня
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const activeYesterday = await db.prepare(
            "SELECT * FROM daily_quests WHERE userId = ? AND date = ? AND status = 'active'"
        ).all(userId, yesterday) as any[];

        for (const aq of activeYesterday) {
            db.prepare(
                'UPDATE daily_quests SET date = ?, snapshot = ? WHERE id = ?'
            ).run(today, JSON.stringify(now), aq.id);
        }

        // Генерируем недостающие available квесты
        const existingTypes = new Set(activeYesterday.map((q: any) => q.questType));
        const stmt = db.prepare(
            'INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const qt of QUEST_TYPES) {
            if (existingTypes.has(qt)) continue;
            const diffs = Object.keys(DIFFICULTIES);
            const diff = diffs[Math.floor(Math.random() * diffs.length)] as DiffKey;
            const d = DIFFICULTIES[diff];
            const req = d.req[qt];
            const rw = BASE_REWARDS[qt];
            stmt.run(userId, qt, diff, req, Math.round(rw.xp * d.rewardMult), Math.round(rw.money * d.rewardMult), 'available', JSON.stringify(now), today);
        }

        quests = await db.prepare(
            'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id'
        ).all(userId, today) as any[];
    }

    // Обновляем прогресс
    for (const q of quests) {
        if (q.status === 'active') {
            const prog = getProgress(userId, q.snapshot, q.questType);
            if (prog !== q.progress) {
                await db.prepare('UPDATE daily_quests SET progress = ? WHERE id = ?').run(Math.min(prog, q.requirement), q.id);
                q.progress = Math.min(prog, q.requirement);
            }
        }
    }

    const activeCount = quests.filter((q: any) => q.status === 'active').length;
    const completedToday = quests.filter((q: any) => q.status === 'claimed').length;
    const canTake = activeCount < 3 && (activeCount + completedToday) < 5;

    res.json({
        quests: quests.filter((q: any) => q.status !== 'claimed').map((q: any) => {
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
        resetAt: getMidnightTS(),
    });
});

// Взять квест
router.post('/tavern/quests/take', async (req, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId) return res.status(400).json({ error: 'Укажите questId' });

    const quest = await db.prepare('SELECT * FROM daily_quests WHERE id = ? AND userId = ?').get(questId, userId) as any;
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'available') return res.status(400).json({ error: 'Квест недоступен' });

    const today = getToday();
    const activeCount = (await db.prepare(
        "SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND status = 'active' AND date = ?"
    ).get(userId, today) as any).cnt;
    if (activeCount >= 3) return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });

    const completedToday = (await db.prepare(
        "SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND date = ? AND status = 'claimed'"
    ).get(userId, today) as any).cnt;
    if (activeCount + completedToday >= 5) return res.status(400).json({ error: 'Дневной лимит квестов (5) исчерпан' });
    if (activeCount >= 3) return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });

    const snapshot = JSON.stringify(getSnapshot(userId));
    await db.prepare('UPDATE daily_quests SET status = ?, snapshot = ?, progress = 0 WHERE id = ?')
        .run('active', snapshot, questId);

    res.json({ success: true });
});

// Сдать квест
router.post('/tavern/quests/claim', async (req, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId) return res.status(400).json({ error: 'Укажите questId' });

    const quest = await db.prepare('SELECT * FROM daily_quests WHERE id = ? AND userId = ?').get(questId, userId) as any;
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'active') return res.status(400).json({ error: 'Квест не активен' });

    const prog = getProgress(userId, quest.snapshot, quest.questType);
    if (prog < quest.requirement) {
        return res.status(400).json({ error: `Прогресс: ${prog}/${quest.requirement}` });
    }

    await db.prepare('UPDATE users SET money = money + ?, exp = exp + ? WHERE id = ?')
        .run(quest.rewardMoney, quest.rewardXp, userId);
    await db.prepare('UPDATE daily_quests SET status = ?, progress = ? WHERE id = ?')
        .run('claimed', quest.requirement, questId);

    await db.prepare('INSERT INTO quest_history (userId, questType, difficulty, typeName, rewardXp, rewardMoney) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, quest.questType, quest.difficulty, QUEST_INFO[quest.questType as QuestType]?.name || quest.questType, quest.rewardXp, quest.rewardMoney);

    // Выдаём новый квест того же типа со случайной сложностью
    const today = getToday();
    const diffs = Object.keys(DIFFICULTIES);
    const newDiff = diffs[Math.floor(Math.random() * diffs.length)] as DiffKey;
    const d = DIFFICULTIES[newDiff];
    const newReq = d.req[quest.questType as QuestType];
    const rw = BASE_REWARDS[quest.questType as QuestType];
    await db.prepare('INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(userId, quest.questType, newDiff, newReq, Math.round(rw.xp * d.rewardMult), Math.round(rw.money * d.rewardMult), 'available', JSON.stringify(getSnapshot(userId)), today);

    const updated = await db.prepare('SELECT money, exp FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, rewardXp: quest.rewardXp, rewardMoney: quest.rewardMoney, money: updated.money, exp: updated.exp });
});

export default router;
