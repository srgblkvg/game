"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
// Игровые
router.get('/jobs', (req, res) => {
    const jobs = database_1.default.prepare('SELECT * FROM jobs').all();
    res.json(jobs);
});
router.post('/jobs/start', (req, res) => {
    const parsed = validation_1.startJobSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const userId = req.userId;
    const { jobId } = parsed.data;
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.activeJob)
        return res.status(400).json({ error: 'Вы уже выполняете работу' });
    const job = database_1.default.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job)
        return res.status(404).json({ error: 'Job not found' });
    const now = Math.floor(Date.now() / 1000);
    const endTime = now + job.duration;
    const reward = Math.floor(Math.random() * (job.rewardMax - job.rewardMin + 1)) + job.rewardMin;
    const activeJob = JSON.stringify({ jobId, name: job.name, startTime: now, endTime, reward, duration: job.duration });
    database_1.default.prepare('UPDATE users SET activeJob = ? WHERE id = ?').run(activeJob, userId);
    res.json({ success: true, endTime, reward, jobName: job.name });
});
router.get('/jobs/history', (req, res) => {
    const userId = req.userId;
    const history = database_1.default.prepare('SELECT * FROM job_history WHERE userId = ? ORDER BY finishedAt DESC LIMIT 10').all(userId);
    res.json(history);
});
// Административные
router.get('/admin/jobs', (req, res) => {
    const jobs = database_1.default.prepare('SELECT * FROM jobs ORDER BY id').all();
    res.json(jobs);
});
router.post('/admin/jobs', (req, res) => {
    const parsed = validation_1.createJobSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные работы' });
    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    database_1.default.prepare('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)')
        .run(name, description || '', duration, rewardMin || 0, rewardMax || 0);
    res.json({ success: true });
});
router.put('/admin/jobs/:id', (req, res) => {
    const parsed = validation_1.createJobSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные работы' });
    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    database_1.default.prepare('UPDATE jobs SET name=?, description=?, duration=?, rewardMin=?, rewardMax=? WHERE id=?')
        .run(name, description, duration, rewardMin, rewardMax, req.params.id);
    res.json({ success: true });
});
router.delete('/admin/jobs/:id', (req, res) => {
    database_1.default.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=jobs.js.map