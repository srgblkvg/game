import { Router } from 'express';
import db from '../database';

const router = Router();

// Получить все работы (админка)
router.get('/jobs', (req: any, res) => {
    const jobs = db.prepare('SELECT * FROM jobs ORDER BY duration ASC').all();
    res.json(jobs);
});

// Создать работу
router.post('/jobs', (req, res) => {
    const { name, description, duration, rewardMin, rewardMax, background } = req.body;
    if (!name || duration == null) return res.status(400).json({ error: 'name, duration required' });
    db.prepare('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax, background) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, description || '', duration, rewardMin || 0, rewardMax || 0, background || null);
    res.json({ success: true });
});

// Редактировать работу
router.put('/jobs/:id', (req, res) => {
    const { name, description, duration, rewardMin, rewardMax, background } = req.body;
    db.prepare('UPDATE jobs SET name=?, description=?, duration=?, rewardMin=?, rewardMax=?, background=? WHERE id=?')
        .run(name, description, duration, rewardMin, rewardMax, background || null, req.params.id);
    res.json({ success: true });
});

// Удалить работу
router.delete('/jobs/:id', (req, res) => {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Принудительно завершить работу игрока
router.post('/finish-job', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.activeJob) return res.status(400).json({ error: 'Игрок не в работе' });

    let jobData: any;
    try { jobData = JSON.parse(user.activeJob); } catch { return res.status(500).json({ error: 'Ошибка парсинга данных работы' }); }

    const reward = jobData.reward || 0;
    const newMoney = user.money + reward;
    db.prepare('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?').run(newMoney, userId);
    db.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, jobData.jobId, jobData.name, jobData.duration, reward, new Date(jobData.startTime * 1000).toISOString());

    res.json({ success: true, message: `Работа "${jobData.name}" завершена, начислено ${reward} монет.` });
});

// Завершить все работы по ID работы
router.post('/finish-jobs-by-jobid', (req, res) => {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const users = db.prepare('SELECT * FROM users WHERE activeJob IS NOT NULL').all() as any[];
    let count = 0;
    for (const user of users) {
        try {
            const jobData = JSON.parse(user.activeJob);
            if (jobData.jobId == jobId) {
                const reward = jobData.reward || 0;
                const newMoney = user.money + reward;
                db.prepare('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?').run(newMoney, user.id);
                db.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(user.id, jobData.jobId, jobData.name, jobData.duration, reward, new Date(jobData.startTime * 1000).toISOString());
                count++;
            }
        } catch { }
    }
    res.json({ success: true, count });
});

export default router;