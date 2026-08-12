"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Получить все работы (админка)
router.get('/jobs', async (req, res) => {
    const jobs = await index_1.db.query('SELECT * FROM jobs ORDER BY duration ASC', []);
    res.json(jobs);
});
// Создать работу
router.post('/jobs', async (req, res) => {
    const { name, description, duration, rewardMin, rewardMax, background } = req.body;
    if (!name || duration == null)
        return res.status(400).json({ error: 'name, duration required' });
    await index_1.db.run('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax, background) VALUES (?, ?, ?, ?, ?, ?)', [name, description || '', duration, rewardMin || 0, rewardMax || 0, background || null]);
    res.json({ success: true });
});
// Редактировать работу
router.put('/jobs/:id', async (req, res) => {
    const { name, description, duration, rewardMin, rewardMax, background } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) {
        fields.push('name=?');
        values.push(name);
    }
    if (description !== undefined) {
        fields.push('description=?');
        values.push(description);
    }
    if (duration !== undefined) {
        fields.push('duration=?');
        values.push(duration);
    }
    if (rewardMin !== undefined) {
        fields.push('rewardMin=?');
        values.push(rewardMin);
    }
    if (rewardMax !== undefined) {
        fields.push('rewardMax=?');
        values.push(rewardMax);
    }
    if (background !== undefined) {
        fields.push('background=?');
        values.push(background || null);
    }
    if (fields.length === 0)
        return res.status(400).json({ error: 'Нет данных для обновления' });
    values.push(req.params.id);
    await index_1.db.run(`UPDATE jobs SET ${fields.join(',')} WHERE id=?`, values);
    res.json({ success: true });
});
// Удалить работу
router.delete('/jobs/:id', async (req, res) => {
    await index_1.db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});
// Принудительно завершить работу игрока
router.post('/finish-job', async (req, res) => {
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (!user.activeJob)
        return res.status(400).json({ error: 'Игрок не в работе' });
    let jobData;
    try {
        jobData = JSON.parse(user.activeJob);
    }
    catch {
        return res.status(500).json({ error: 'Ошибка парсинга данных работы' });
    }
    const reward = jobData.reward || 0;
    const newMoney = user.money + reward;
    await index_1.db.run('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?', [newMoney, userId]);
    await index_1.db.run('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)', [userId, jobData.jobId, jobData.name, jobData.duration, reward, new Date(jobData.startTime * 1000).toISOString()]);
    res.json({ success: true, message: `Работа "${jobData.name}" завершена, начислено ${reward} монет.` });
});
// Завершить все работы по ID работы
router.post('/finish-jobs-by-jobid', async (req, res) => {
    const { jobId } = req.body;
    if (!jobId)
        return res.status(400).json({ error: 'jobId required' });
    const users = await index_1.db.query('SELECT * FROM users WHERE activeJob IS NOT NULL', []);
    let count = 0;
    for (const user of users) {
        try {
            const jobData = JSON.parse(user.activeJob);
            if (jobData.jobId == jobId) {
                const reward = jobData.reward || 0;
                const newMoney = user.money + reward;
                await index_1.db.run('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?', [newMoney, user.id]);
                await index_1.db.run('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)', [user.id, jobData.jobId, jobData.name, jobData.duration, reward, new Date(jobData.startTime * 1000).toISOString()]);
                count++;
            }
        }
        catch { }
    }
    res.json({ success: true, count });
});
exports.default = router;
//# sourceMappingURL=adminJobs.js.map