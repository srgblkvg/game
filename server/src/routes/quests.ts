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

function getSnapshot(userId: number): Record<string, number> {
    const u = db.prepare(
        'SELECT pveTotalBattles, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?'
    ).get(userId) as any;
    return {
        pve: u?.pveTotalBattles || 0,
        pvpWins: u?.wins || 0,
        craft: u?.craftCount || 0,
        auction: u?.auctionTrades || 0,
        jobSec: u?.totalJobSeconds || 0,
    };
}

function getProgress(userId: number, snapshot: any, questType: QuestType): number {
    const u = db.prepare(
        'SELECT pveTotalBattles, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?'
    ).get(userId) as any;
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    switch (questType) {
        case 'hunt': return (u?.pveTotalBattles || 0) - (s.pve || 0);
        case 'arena': return (u?.wins || 0) - (s.pvpWins || 0);
        case 'craft': return (u?.craftCount || 0) - (s.craft || 0);
        case 'auction': return (u?.auctionTrades || 0) - (s.auction || 0);
        case 'job': return (u?.totalJobSeconds || 0) - (s.jobSec || 0);
        default: return 0;
    }
}

// Получить/сгенерировать квесты
router.get('/tavern/quests', (req: any, res) => {
    const userId = req.userId;
    const today = new Date().toISOString().slice(0, 10);

    let quests = db.prepare(
        'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id'
    ).all(userId, today) as any[];

    if (quests.length === 0) {
        const stmt = db.prepare(
            'INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const qt of QUEST_TYPES) {
            const diffs = Object.keys(DIFFICULTIES);
            const diff = diffs[Math.floor(Math.random() * diffs.length)] as DiffKey;
            const d = DIFFICULTIES[diff];
            const req = d.req[qt];
            const rw = BASE_REWARDS[qt];
            const snapshot = JSON.stringify(getSnapshot(userId));
            stmt.run(userId, qt, diff, req, Math.round(rw.xp * d.rewardMult), Math.round(rw.money * d.rewardMult), 'available', snapshot, today);
        }
        quests = db.prepare(
            'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id'
        ).all(userId, today) as any[];
    }

    // Обновляем прогресс
    for (const q of quests) {
        if (q.status === 'active') {
            const prog = getProgress(userId, q.snapshot, q.questType);
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
        quests: quests.map((q: any) => {
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

    const prog = getProgress(userId, quest.snapshot, quest.questType);
    if (prog < quest.requirement) {
        return res.status(400).json({ error: `Прогресс: ${prog}/${quest.requirement}` });
    }

    db.prepare('UPDATE users SET money = money + ?, exp = exp + ? WHERE id = ?')
        .run(quest.rewardMoney, quest.rewardXp, userId);
    db.prepare('UPDATE daily_quests SET status = ?, progress = ? WHERE id = ?')
        .run('claimed', quest.requirement, questId);

    // Сохраняем в историю
    db.prepare('INSERT INTO quest_history (userId, questType, difficulty, typeName, rewardXp, rewardMoney) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, quest.questType, quest.difficulty, QUEST_INFO[quest.questType as QuestType]?.name || quest.questType, quest.rewardXp, quest.rewardMoney);

    const updated = db.prepare('SELECT money, exp FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, rewardXp: quest.rewardXp, rewardMoney: quest.rewardMoney, money: updated.money, exp: updated.exp });
});

export default router;
