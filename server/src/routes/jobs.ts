import { Router } from 'express';
import db from '../database';
import { startJobSchema, createJobSchema } from '../validation';

const router = Router();

// Игровые
router.get('/jobs', (req: any, res) => {
    const jobs = db.prepare('SELECT * FROM jobs').all();
    res.json(jobs);
});

router.post('/jobs/start', (req: any, res) => {
    const parsed = startJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const userId = req.userId;
    const { jobId } = parsed.data;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.activeJob) return res.status(400).json({ error: 'Вы уже выполняете работу' });

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const now = Math.floor(Date.now() / 1000);
    const endTime = now + job.duration;
    const reward = Math.floor(Math.random() * (job.rewardMax - job.rewardMin + 1)) + job.rewardMin;
    const expReward = Math.max(1, Math.floor(job.duration / 3600));

    const activeJob = JSON.stringify({ jobId, name: job.name, startTime: now, endTime, reward, duration: job.duration, expReward, rewardMin: job.rewardMin, rewardMax: job.rewardMax });
    db.prepare('UPDATE users SET activeJob = ? WHERE id = ?').run(activeJob, userId);

    res.json({ success: true, endTime, reward, jobName: job.name, expReward, rewardMin: job.rewardMin, rewardMax: job.rewardMax });
});

router.get('/jobs/history', (req: any, res) => {
    const userId = req.userId;
    const history = db.prepare('SELECT * FROM job_history WHERE userId = ? ORDER BY finishedAt DESC LIMIT 10').all(userId);
    res.json(history);
});

// Административные
router.get('/admin/jobs', (req: any, res) => {
    const jobs = db.prepare('SELECT * FROM jobs ORDER BY id').all();
    res.json(jobs);
});

router.post('/admin/jobs', (req: any, res) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные работы' });

    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    db.prepare('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)')
        .run(name, description || '', duration, rewardMin || 0, rewardMax || 0);
    res.json({ success: true });
});

router.put('/admin/jobs/:id', (req: any, res) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные работы' });

    const { name, description, duration, rewardMin, rewardMax } = parsed.data;
    db.prepare('UPDATE jobs SET name=?, description=?, duration=?, rewardMin=?, rewardMax=? WHERE id=?')
        .run(name, description, duration, rewardMin, rewardMax, req.params.id);
    res.json({ success: true });
});

router.delete('/admin/jobs/:id', (req: any, res) => {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;