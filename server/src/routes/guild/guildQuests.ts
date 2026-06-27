import { Router } from "express";
import { db } from "../../db/index";
import { sendToGuild } from "../../events";

const router = Router();

const GUILD_QUEST_TYPES = ['pve', 'pvp', 'craft', 'donate', 'jobs'] as const;
type GuildQuestType = typeof GUILD_QUEST_TYPES[number];

const GUILD_QUEST_INFO: Record<GuildQuestType, { name: string; desc: (req: number) => string; snapshotFields: string }> = {
    pve: { name: 'Истребление', desc: (r) => `Убить ${r} мобов (общий счёт гильдии)`, snapshotFields: 'pveWins' },
    pvp: { name: 'Кровь врагов', desc: (r) => `Одержать ${r} PvP-побед (общий счёт гильдии)`, snapshotFields: 'wins' },
    craft: { name: 'Кузня', desc: (r) => `Создать/улучшить ${r} предметов (общий счёт гильдии)`, snapshotFields: 'craftCount' },
    donate: { name: 'Казна', desc: (r) => `Пожертвовать ${r} серебра в казну`, snapshotFields: 'treasury' },
    jobs: { name: 'Труд', desc: (r) => `Накопить ${r} секунд работы (общий счёт гильдии)`, snapshotFields: 'totalJobSeconds' },
};

const GUILD_QUEST_DIFFICULTIES = {
    easy:   { label: '⭐ Простой',   xpMin: 1, xpMax: 3, reqMult: 1 },
    medium: { label: '⭐⭐ Средний',  xpMin: 4, xpMax: 6, reqMult: 3 },
    hard:   { label: '⭐⭐⭐ Сложный', xpMin: 7, xpMax: 10, reqMult: 8 },
} as const;

/** Обновить прогресс активного квеста гильдии и разослать по WS */
export async function updateGuildQuestProgress(guildId: number) {
    const activeQuest = await db.one(
        "SELECT * FROM guild_quests WHERE guildId = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        [guildId]
    ) as any;
    if (!activeQuest) return;

    const snap = JSON.parse(activeQuest.snapshot || '{}');
    const members = await db.query('SELECT userId FROM guild_members WHERE guildId = ?', [guildId]) as any[];
    const userIds = members.map((m: any) => m.userId);

    let currentValue = 0;
    if (activeQuest.questType === 'donate') {
        const g = await db.one('SELECT treasury FROM guilds WHERE id = ?', [guildId]) as any;
        currentValue = (g?.treasury || 0) - (snap.treasury || 0);
    } else {
        const field = GUILD_QUEST_INFO[activeQuest.questType as GuildQuestType]?.snapshotFields;
        if (field && userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');
            const rows = await db.query(
                `SELECT SUM(\"${field}\") as total FROM users WHERE id IN (${placeholders})`,
                userIds
            ) as any[];
            currentValue = (rows[0]?.total || 0) - (snap[field] || 0);
        }
    }

    const newProgress = Math.min(currentValue, activeQuest.requirement);
    if (newProgress !== activeQuest.progress) {
        await db.run('UPDATE guild_quests SET progress = ? WHERE id = ?', [newProgress, activeQuest.id]);
        activeQuest.progress = newProgress;
    }

    const info = GUILD_QUEST_INFO[activeQuest.questType as GuildQuestType];
    const questData = {
        ...activeQuest,
        typeName: info?.name || activeQuest.questType,
        description: info?.desc(activeQuest.requirement) || '',
        difficultyLabel: GUILD_QUEST_DIFFICULTIES[activeQuest.difficulty as keyof typeof GUILD_QUEST_DIFFICULTIES]?.label || activeQuest.difficulty,
    };

    sendToGuild(guildId, { type: 'guildQuestProgress', activeQuest: questData });
    return questData;
}

// Получить задания гильдии (3 случайных на выбор)
router.get('/guild/quest', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.json({ activeQuest: null, options: null });

    // Активное задание — обновить прогресс и вернуть
    const questData = await updateGuildQuestProgress(member.guildId);
    if (questData) {
        return res.json({ activeQuest: questData, options: null });
    }

    // Нет активного — генерируем 3 варианта
    const options: any[] = [];
    const usedTypes = new Set<string>();
    for (let i = 0; i < 3; i++) {
        const availableTypes = GUILD_QUEST_TYPES.filter(t => !usedTypes.has(t));
        if (availableTypes.length === 0) break;
        const questType = availableTypes[Math.floor(Math.random() * availableTypes.length)]!;
        usedTypes.add(questType);

        const diffs = Object.keys(GUILD_QUEST_DIFFICULTIES);
        const difficulty = diffs[Math.floor(Math.random() * diffs.length)] as keyof typeof GUILD_QUEST_DIFFICULTIES;
        const d = GUILD_QUEST_DIFFICULTIES[difficulty];
        const rewardXp = Math.floor(Math.random() * (d.xpMax - d.xpMin + 1)) + d.xpMin;
        const baseReqs: Record<string, number> = { pve: 50, pvp: 10, craft: 10, donate: 500, jobs: 1800 };
        const requirement = (baseReqs[questType as string] || 50) * d.reqMult;
        const info = GUILD_QUEST_INFO[questType as GuildQuestType];

        options.push({
            questType, difficulty, requirement, rewardXp,
            typeName: info.name, description: info.desc(requirement),
            difficultyLabel: d.label,
        });
    }

    res.json({ activeQuest: null, options });
});

// Взять задание (лидер выбирает из предложенных)
router.post('/guild/quest/take', async (req, res) => {
    const userId = req.userId;
    const { questType, difficulty, requirement, rewardXp } = req.body;

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может управлять заданиями' });

    if (!questType || !difficulty || !requirement || !rewardXp) return res.status(400).json({ error: 'Выберите задание' });

    // Отменяем текущее активное
    await db.run("UPDATE guild_quests SET status = 'cancelled' WHERE guildId = ? AND status = 'active'", [member.guildId]);

    // Снапшот
    const members = await db.query('SELECT userId FROM guild_members WHERE guildId = ?', [member.guildId]) as any[];
    const userIds = members.map((m: any) => m.userId);
    const snapshot: any = {};

    const placeholders = userIds.map(() => '?').join(',');
    if (questType === 'donate') {
        const g = await db.one('SELECT treasury FROM guilds WHERE id = ?', [member.guildId]) as any;
        snapshot.treasury = g?.treasury || 0;
    } else if (userIds.length > 0) {
        const field = GUILD_QUEST_INFO[questType as GuildQuestType]?.snapshotFields;
        if (field) {
            const rows = await db.query(
                `SELECT SUM("${field}") as total FROM users WHERE id IN (${placeholders})`,
                userIds
            ) as any[];
            snapshot[field] = rows[0]?.total || 0;
        }
    }

    await db.run(
        'INSERT INTO guild_quests (guildId, questType, difficulty, requirement, rewardXp, snapshot) VALUES (?, ?, ?, ?, ?, ?)',
        [member.guildId, questType, difficulty, requirement, rewardXp, JSON.stringify(snapshot)]
    );

    res.json({ success: true, message: 'Задание взято!' });
});

// Забрать награду (лидер)
router.post('/guild/quest/claim', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может забирать награду' });

    const quest = await db.one(
        "SELECT * FROM guild_quests WHERE guildId = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        [member.guildId]
    ) as any;
    if (!quest) return res.status(400).json({ error: 'Нет активного задания' });
    if (quest.progress < quest.requirement) return res.status(400).json({ error: `Задание не выполнено: ${quest.progress}/${quest.requirement}` });

    await db.run("UPDATE guild_quests SET status = 'claimed' WHERE id = ?", [quest.id]);
    await db.run('UPDATE guilds SET exp = exp + ? WHERE id = ?', [quest.rewardXp, member.guildId]);

    const g = await db.one('SELECT exp, level FROM guilds WHERE id = ?', [member.guildId]) as any;
    let newLevel = g.level;
    let leveledUp = false;
    while (g.exp >= 100 * Math.pow(2, newLevel - 1)) {
      newLevel++;
      leveledUp = true;
    }
    if (leveledUp) {
      await db.run('UPDATE guilds SET level = ? WHERE id = ?', [newLevel, member.guildId]);
      sendToGuild(member.guildId, { type: 'guildLevelUp', level: newLevel, exp: g.exp });
    }
    sendToGuild(member.guildId, { type: 'guildExp', exp: g.exp, level: leveledUp ? newLevel : g.level });

    res.json({ success: true, rewardXp: quest.rewardXp, leveledUp, message: `+${quest.rewardXp} опыта гильдии!` });
});




export default router;
