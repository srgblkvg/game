"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const router = (0, express_1.Router)();
// Получить все работы (админка)
router.get('/jobs', (req, res) => {
    const jobs = database_1.default.prepare('SELECT * FROM jobs ORDER BY duration ASC').all();
    res.json(jobs);
});
// Создать работу
router.post('/jobs', (req, res) => {
    const { name, description, duration, rewardMin, rewardMax } = req.body;
    if (!name || duration == null)
        return res.status(400).json({ error: 'name, duration required' });
    database_1.default.prepare('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)')
        .run(name, description || '', duration, rewardMin || 0, rewardMax || 0);
    res.json({ success: true });
});
// Редактировать работу
router.put('/jobs/:id', (req, res) => {
    const { name, description, duration, rewardMin, rewardMax } = req.body;
    database_1.default.prepare('UPDATE jobs SET name=?, description=?, duration=?, rewardMin=?, rewardMax=? WHERE id=?')
        .run(name, description, duration, rewardMin, rewardMax, req.params.id);
    res.json({ success: true });
});
// Удалить работу
router.delete('/jobs/:id', (req, res) => {
    database_1.default.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});
// Принудительно завершить работу игрока
router.post('/finish-job', (req, res) => {
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
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
    database_1.default.prepare('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?').run(newMoney, userId);
    database_1.default.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, jobData.jobId, jobData.name, jobData.duration, reward, new Date(jobData.startTime * 1000).toISOString());
    res.json({ success: true, message: `Работа "${jobData.name}" завершена, начислено ${reward} монет.` });
});
// Завершить все работы по ID работы
router.post('/finish-jobs-by-jobid', (req, res) => {
    const { jobId } = req.body;
    if (!jobId)
        return res.status(400).json({ error: 'jobId required' });
    const users = database_1.default.prepare('SELECT * FROM users WHERE activeJob IS NOT NULL').all();
    let count = 0;
    for (const user of users) {
        try {
            const jobData = JSON.parse(user.activeJob);
            if (jobData.jobId == jobId) {
                const reward = jobData.reward || 0;
                const newMoney = user.money + reward;
                database_1.default.prepare('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?').run(newMoney, user.id);
                database_1.default.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(user.id, jobData.jobId, jobData.name, jobData.duration, reward, new Date(jobData.startTime * 1000).toISOString());
                count++;
            }
        }
        catch { }
    }
    res.json({ success: true, count });
});
exports.default = router;
//# sourceMappingURL=adminJobs.js.map