"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const helpers_1 = require("../db/helpers");
const events_1 = require("../events");
const questData_1 = require("../game/questData");
const router = (0, express_1.Router)();
// Получить/сгенерировать квесты
router.get('/tavern/quests', async (req, res) => {
    const userId = req.userId;
    const today = await (0, questData_1.getToday)();
    let quests = await index_1.db.query('SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id', [userId, today]);
    if (quests.length === 0) {
        const now = await (0, questData_1.getSnapshot)(userId);
        // Переносим ВСЕ активные квесты с прошлых дней на сегодня (не только вчера)
        const activeOld = await index_1.db.query("SELECT * FROM daily_quests WHERE userId = ? AND date < ? AND status = 'active'", [userId, today]);
        for (const aq of activeOld) {
            await index_1.db.run('UPDATE daily_quests SET date = ? WHERE id = ?', [today, aq.id]);
        }
        // Генерируем недостающие available квесты
        const existingTypes = new Set(activeOld.map((q) => q.questType));
        for (const qt of questData_1.QUEST_TYPES) {
            if (existingTypes.has(qt))
                continue;
            const diffs = Object.keys(questData_1.DIFFICULTIES);
            const diff = diffs[Math.floor(Math.random() * diffs.length)];
            const d = questData_1.DIFFICULTIES[diff];
            const req = d.req[qt];
            const rw = questData_1.BASE_REWARDS[qt];
            await index_1.db.run('INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [userId, qt, diff, req, Math.round(rw.xp * d.rewardXpMult), Math.round(rw.money * d.rewardMoneyMult), 'available', JSON.stringify(now), today]);
        }
        quests = await index_1.db.query('SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id', [userId, today]);
    }
    // Обновляем прогресс
    for (const q of quests) {
        if (q.status === 'active') {
            const prog = await (0, questData_1.getProgress)(userId, q.snapshot, q.questType);
            if (prog !== q.progress) {
                await index_1.db.run('UPDATE daily_quests SET progress = ? WHERE id = ?', [Math.min(prog, q.requirement), q.id]);
                q.progress = Math.min(prog, q.requirement);
            }
        }
    }
    const activeCount = quests.filter((q) => q.status === 'active').length;
    const completedToday = quests.filter((q) => q.status === 'claimed').length;
    const canTake = activeCount < 3 && (activeCount + completedToday) < 5;
    res.json({
        quests: quests.filter((q) => q.status !== 'claimed').map((q) => {
            const qt = q.questType;
            const info = questData_1.QUEST_INFO[qt];
            return {
                ...q,
                typeName: info.name,
                typeIcon: info.icon,
                description: info.desc(q.requirement, q.difficulty),
                difficultyLabel: questData_1.DIFFICULTIES[q.difficulty]?.label || q.difficulty,
                snapshot: undefined,
            };
        }),
        activeCount,
        completedToday,
        canTake,
        dailyLimit: 5,
        maxActive: 3,
        resetAt: await (0, questData_1.getMidnightTS)(),
    });
});
// Взять квест
router.post('/tavern/quests/take', async (req, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId)
        return res.status(400).json({ error: 'Укажите questId' });
    const quest = await index_1.db.one('SELECT * FROM daily_quests WHERE id = ? AND userId = ?', [questId, userId]);
    if (!quest)
        return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'available')
        return res.status(400).json({ error: 'Квест недоступен' });
    const today = await (0, questData_1.getToday)();
    const activeCount = (await index_1.db.one("SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND status = 'active' AND date = ?", [userId, today])).cnt;
    if (activeCount >= 3)
        return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });
    const completedToday = (await index_1.db.one("SELECT COUNT(*) as cnt FROM daily_quests WHERE userId = ? AND date = ? AND status = 'claimed'", [userId, today])).cnt;
    if (activeCount + completedToday >= 5)
        return res.status(400).json({ error: 'Дневной лимит квестов (5) исчерпан' });
    if (activeCount >= 3)
        return res.status(400).json({ error: 'Можно взять максимум 3 квеста одновременно' });
    const snapshot = JSON.stringify(await (0, questData_1.getSnapshot)(userId));
    await index_1.db.run('UPDATE daily_quests SET status = ?, snapshot = ?, progress = 0 WHERE id = ?', ['active', snapshot, questId]);
    res.json({ success: true });
    // Вместо sendDailyQuestsUpdate — помечаем dirty, serverTick сам отправит
    (0, events_1.markDirty)(userId, 'quests');
});
// Сдать квест
router.post('/tavern/quests/claim', async (req, res) => {
    const userId = req.userId;
    const questId = parseInt(req.body.questId);
    if (!questId)
        return res.status(400).json({ error: 'Укажите questId' });
    const quest = await index_1.db.one('SELECT * FROM daily_quests WHERE id = ? AND userId = ?', [questId, userId]);
    if (!quest)
        return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'active')
        return res.status(400).json({ error: 'Квест не активен' });
    const prog = await (0, questData_1.getProgress)(userId, quest.snapshot, quest.questType);
    if (prog < quest.requirement) {
        return res.status(400).json({ error: `Прогресс: ${prog}/${quest.requirement}` });
    }
    // Атомарно помечаем квест как claimed — защита от повторной выдачи награды
    const claimResult = await index_1.db.run("UPDATE daily_quests SET status = 'claimed', progress = ? WHERE id = ? AND status = 'active'", [quest.requirement, questId]);
    if (claimResult.changes === 0) {
        return res.status(400).json({ error: 'Квест уже сдан' });
    }
    // Налог гильдии
    const rewardAfterTax = await (0, helpers_1.collectGuildTax)(userId, quest.rewardMoney, 'tax_quest');
    await index_1.db.run('UPDATE users SET money = money + ? WHERE id = ?', [rewardAfterTax, userId]);
    // Получаем текущие exp/level для applyExp
    const user = await index_1.db.one('SELECT exp, level, statPoints FROM users WHERE id = ?', [userId]);
    const { newExp, newLevel, levelsGained, newStatPoints } = await (0, helpers_1.applyExp)(userId, quest.rewardXp, user.exp, user.level, user.statPoints || 0);
    await index_1.db.run('UPDATE users SET exp = ?, level = ?, statPoints = ? WHERE id = ?', [newExp, newLevel, newStatPoints, userId]);
    await index_1.db.run('INSERT INTO quest_history (userId, questType, difficulty, typeName, rewardXp, rewardMoney) VALUES (?, ?, ?, ?, ?, ?)', [userId, quest.questType, quest.difficulty, questData_1.QUEST_INFO[quest.questType]?.name || quest.questType, quest.rewardXp, quest.rewardMoney]);
    // Выдаём новый квест того же типа со случайной сложностью
    const today = await (0, questData_1.getToday)();
    const diffs = Object.keys(questData_1.DIFFICULTIES);
    const newDiff = diffs[Math.floor(Math.random() * diffs.length)];
    const d = questData_1.DIFFICULTIES[newDiff];
    const newReq = d.req[quest.questType];
    const rw = questData_1.BASE_REWARDS[quest.questType];
    await index_1.db.run('INSERT INTO daily_quests (userId, questType, difficulty, requirement, rewardXp, rewardMoney, status, snapshot, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [userId, quest.questType, newDiff, newReq, Math.round(rw.xp * d.rewardXpMult), Math.round(rw.money * d.rewardMoneyMult), 'available', JSON.stringify(await (0, questData_1.getSnapshot)(userId)), today]);
    const updated = await index_1.db.one('SELECT money, exp, level, statPoints FROM users WHERE id = ?', [userId]);
    res.json({ success: true, rewardXp: quest.rewardXp, rewardMoney: rewardAfterTax, money: updated.money, exp: updated.exp, level: updated.level, statPoints: updated.statPoints, levelsGained });
    // Вместо sendDailyQuestsUpdate — dirty-флаг
    (0, events_1.markDirty)(userId, 'quests');
});
exports.default = router;
//# sourceMappingURL=quests.js.map