import { Router } from 'express';
import { db } from '../db/index';
import { completeJob, jobIdentity } from '../game/jobCompletion';
import { createPgJobCompletionRepository } from '../game/jobCompletionRepository';
import { runJobCompletionEffects } from '../game/jobCompletionEffects';

const router = Router();

// Получить все работы (админка)
router.get('/jobs', async (req, res) => {
    const jobs = await db.query('SELECT * FROM jobs ORDER BY duration ASC', []);
    res.json(jobs);
});

// Создать работу
router.post('/jobs', async (req, res) => {
    const { name, description, duration, rewardMin, rewardMax, background } = req.body;
    if (!name || duration == null) return res.status(400).json({ error: 'name, duration required' });
    await db.run('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax, background) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || '', duration, rewardMin || 0, rewardMax || 0, background || null]);
    res.json({ success: true });
});

// Редактировать работу
router.put('/jobs/:id', async (req, res) => {
    const { name, description, duration, rewardMin, rewardMax, background } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { fields.push('name=?'); values.push(name); }
    if (description !== undefined) { fields.push('description=?'); values.push(description); }
    if (duration !== undefined) { fields.push('duration=?'); values.push(duration); }
    if (rewardMin !== undefined) { fields.push('rewardMin=?'); values.push(rewardMin); }
    if (rewardMax !== undefined) { fields.push('rewardMax=?'); values.push(rewardMax); }
    if (background !== undefined) { fields.push('background=?'); values.push(background || null); }
    if (fields.length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });
    values.push(req.params.id);
    await db.run(`UPDATE jobs SET ${fields.join(',')} WHERE id=?`, values);
    res.json({ success: true });
});

// Удалить работу
router.delete('/jobs/:id', async (req, res) => {
    await db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

// Принудительно завершить работу игрока
router.post('/finish-job', async (req, res) => {
    const userId = Number(req.body.userId);
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const user = await db.one('SELECT activeJob FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.activeJob) return res.status(400).json({ error: 'Игрок не в работе' });
    let job: any;
    try { job = JSON.parse(user.activeJob); } catch { return res.status(500).json({ error: 'Ошибка парсинга данных работы' }); }
    const result = await completeJob(createPgJobCompletionRepository(), {
        userId, now: Math.floor(Date.now() / 1000), mode: 'force', expectedJobIdentity: jobIdentity(job),
    });
    if (!result.completed) return res.status(409).json({ error: 'Работа уже изменена или завершена' });
    await runJobCompletionEffects(result);
    res.json({ success: true, message: `Работа "${result.job.name}" завершена, начислено ${result.rewardAfterTax} монет.` });
});

// Завершить все работы по ID работы
router.post('/finish-jobs-by-jobid', async (req, res) => {
    const jobId = Number(req.body.jobId);
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const users = await db.query('SELECT id, activeJob FROM users WHERE activeJob IS NOT NULL', []) as any[];
    let count = 0;
    for (const user of users) {
        let job: any;
        try { job = JSON.parse(user.activeJob); } catch { continue; }
        if (Number(job.jobId) !== jobId) continue;
        const result = await completeJob(createPgJobCompletionRepository(), {
            userId: user.id, now: Math.floor(Date.now() / 1000), mode: 'force', expectedJobIdentity: jobIdentity(job),
        });
        if (result.completed) { count++; await runJobCompletionEffects(result); }
    }
    res.json({ success: true, count });
});

export default router;
