import { Router } from 'express';
import { db } from '../db/index';
import { startJobSchema, createJobSchema } from '../validation';
import { cancelJob, jobIdentity } from '../game/jobCompletion';
import { createPgJobCompletionRepository } from '../game/jobCompletionRepository';
import { startJob } from '../game/jobStart';
import { createPgJobStartRepository } from '../game/jobStartRepository';

const router = Router();

// Игровые
router.get('/jobs', async (req, res) => {
    const jobs = await db.query('SELECT * FROM jobs', []);
    res.json(jobs);
});

router.post('/jobs/start', async (req, res) => {
    const parsed = startJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const result = await startJob(createPgJobStartRepository(), {
        userId: req.userId,
        jobId: parsed.data.jobId,
        now: Math.floor(Date.now() / 1000),
    });
    if (!result.started) {
        const status = result.reason === 'user-not-found' || result.reason === 'job-not-found' ? 404 : 400;
        const error = result.reason === 'already-active' ? 'Вы уже выполняете работу' : result.reason === 'user-not-found' ? 'User not found' : 'Job not found';
        return res.status(status).json({ error });
    }
    res.json({
        success: true, endTime: result.job.endTime, reward: result.job.reward,
        jobName: result.job.name, expReward: result.job.expReward,
        rewardMin: result.rewardMin, rewardMax: result.rewardMax,
        premiumBonus: result.job.premiumBonus, background: result.background,
    });
});

// Случайная работа по длительности
router.post('/jobs/start-random', async (req, res) => {
    const { duration } = req.body; // 600, 1800, 3600, 28800
    if (!duration) return res.status(400).json({ error: 'Укажите длительность' });

    const result = await startJob(createPgJobStartRepository(), {
        userId: req.userId,
        duration: Number(duration),
        now: Math.floor(Date.now() / 1000),
    });
    if (!result.started) {
        const status = result.reason === 'user-not-found' || result.reason === 'job-not-found' ? 404 : 400;
        const error = result.reason === 'already-active' ? 'Вы уже выполняете работу' : result.reason === 'user-not-found' ? 'User not found' : 'Нет подходящих работ';
        return res.status(status).json({ error });
    }
    res.json({
        success: true, endTime: result.job.endTime, reward: result.job.reward,
        jobName: result.job.name, expReward: result.job.expReward,
        rewardMin: result.rewardMin, rewardMax: result.rewardMax,
        premiumBonus: result.job.premiumBonus, background: result.background,
    });
});

router.get('/jobs/history', async (req, res) => {
    const userId = req.userId;
    const history = await db.query('SELECT * FROM job_history WHERE userId = ? ORDER BY finishedAt DESC LIMIT 10', [userId]);
    res.json(history);
});

// Отменить работу без награды
router.post('/jobs/cancel', async (req, res) => {
    const userId = req.userId;
    const snapshot = await db.one('SELECT activeJob FROM users WHERE id = ?', [userId]) as any;
    if (!snapshot?.activeJob) return res.status(400).json({ error: 'Нет активной работы' });
    let observedJob: any;
    try { observedJob = JSON.parse(snapshot.activeJob); }
    catch { return res.status(409).json({ error: 'Некорректные данные активной работы' }); }
    const result = await cancelJob(createPgJobCompletionRepository(), {
        userId,
        expectedJobIdentity: jobIdentity(observedJob),
    });
    if (!result.cancelled) return res.status(400).json({ error: 'Нет активной работы' });
    res.json({ success: true });
});

// Административные
router.get('/admin/jobs', async (req, res) => {
    const jobs = await db.query('SELECT * FROM jobs ORDER BY id', []);
    res.json(jobs);
});

router.post('/admin/jobs', async (req, res) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные работы' });

    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    await db.run('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)',
        [name, description || '', duration, rewardMin || 0, rewardMax || 0]);
    res.json({ success: true });
});

router.put('/admin/jobs/:id', async (req, res) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные работы' });

    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    await db.run('UPDATE jobs SET name=?, description=?, duration=?, rewardMin=?, rewardMax=? WHERE id=?',
        [name, description, duration, rewardMin, rewardMax, req.params.id]);
    res.json({ success: true });
});

router.delete('/admin/jobs/:id', async (req, res) => {
    await db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

export default router;
