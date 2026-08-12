"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
// Игровые
router.get('/jobs', async (req, res) => {
    const jobs = await index_1.db.query('SELECT * FROM jobs', []);
    res.json(jobs);
});
router.post('/jobs/start', async (req, res) => {
    const parsed = validation_1.startJobSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const userId = req.userId;
    const { jobId } = parsed.data;
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.activeJob)
        return res.status(400).json({ error: 'Вы уже выполняете работу' });
    const job = await index_1.db.one('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job)
        return res.status(404).json({ error: 'Job not found' });
    startJobForUser(user, job, res);
});
// Случайная работа по длительности
router.post('/jobs/start-random', async (req, res) => {
    const userId = req.userId;
    const { duration } = req.body; // 600, 1800, 3600, 28800
    if (!duration)
        return res.status(400).json({ error: 'Укажите длительность' });
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.activeJob)
        return res.status(400).json({ error: 'Вы уже выполняете работу' });
    const jobs = await index_1.db.query('SELECT * FROM jobs WHERE duration = ?', [duration]);
    if (jobs.length === 0)
        return res.status(404).json({ error: 'Нет подходящих работ' });
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    startJobForUser(user, job, res);
});
async function startJobForUser(user, job, res) {
    const now = Math.floor(Date.now() / 1000);
    const endTime = now + job.duration;
    let reward = Math.floor(Math.random() * (job.rewardMax * (user.level || 1) - job.rewardMin + 1)) + job.rewardMin;
    // Бонус фракции Ремесленник: +100% награды за работы
    if (user.faction === 'crafter') {
        reward = reward * 2;
    }
    const expReward = Math.max(1, Math.floor(job.duration / 3600));
    // Премиум: случайный бонус от 1 до 30% от базовой награды
    let premiumBonus = 0;
    if ((user.premiumUntil || 0) > now) {
        premiumBonus = Math.max(1, Math.floor(Math.random() * Math.floor(reward * 0.3)) + 1);
        reward = reward + premiumBonus;
    }
    const scaledMax = job.rewardMax * (user.level || 1);
    const activeJob = JSON.stringify({ jobId: job.id, name: job.name, startTime: now, endTime, reward, duration: job.duration, expReward, rewardMin: job.rewardMin, rewardMax: scaledMax, premiumBonus, background: job.background || null });
    await index_1.db.run('UPDATE users SET activeJob = ? WHERE id = ?', [activeJob, user.id]);
    res.json({ success: true, endTime, reward, jobName: job.name, expReward, rewardMin: job.rewardMin, rewardMax: scaledMax, premiumBonus, background: job.background || null });
}
router.get('/jobs/history', async (req, res) => {
    const userId = req.userId;
    const history = await index_1.db.query('SELECT * FROM job_history WHERE userId = ? ORDER BY finishedAt DESC LIMIT 10', [userId]);
    res.json(history);
});
// Отменить работу без награды
router.post('/jobs/cancel', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT activeJob FROM users WHERE id = ?', [userId]);
    if (!user || !user.activeJob)
        return res.status(400).json({ error: 'Нет активной работы' });
    await index_1.db.run('UPDATE users SET activeJob = NULL WHERE id = ?', [userId]);
    res.json({ success: true });
});
// Административные
router.get('/admin/jobs', async (req, res) => {
    const jobs = await index_1.db.query('SELECT * FROM jobs ORDER BY id', []);
    res.json(jobs);
});
router.post('/admin/jobs', async (req, res) => {
    const parsed = validation_1.createJobSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные работы' });
    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    await index_1.db.run('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)', [name, description || '', duration, rewardMin || 0, rewardMax || 0]);
    res.json({ success: true });
});
router.put('/admin/jobs/:id', async (req, res) => {
    const parsed = validation_1.createJobSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные работы' });
    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    await index_1.db.run('UPDATE jobs SET name=?, description=?, duration=?, rewardMin=?, rewardMax=? WHERE id=?', [name, description, duration, rewardMin, rewardMax, req.params.id]);
    res.json({ success: true });
});
router.delete('/admin/jobs/:id', async (req, res) => {
    await index_1.db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=jobs.js.map