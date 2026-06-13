import { Router } from 'express';
import db from '../database';

const router = Router();

const DIVISIONS = [
    { name: 'copper', label: 'Медный', minLevel: 1, maxLevel: 15, basePool: 500 },
    { name: 'steel', label: 'Стальной', minLevel: 16, maxLevel: 35, basePool: 2000 },
    { name: 'mithril', label: 'Мифриловый', minLevel: 36, maxLevel: 60, basePool: 8000 },
    { name: 'adamant', label: 'Адамантовый', minLevel: 61, maxLevel: 999, basePool: 25000 },
];

// Получить все турниры
router.get('/tournaments', async (req, res) => {
    const tournaments = await db.manyOrNone(`
        SELECT t.*, 
            (SELECT COUNT(*) FROM tournament_participants WHERE tournamentId = t.id) as participantCount
        FROM tournaments t 
        ORDER BY t.id DESC
    `);
    res.json({ tournaments, divisions: DIVISIONS });
});

// Создать турнир
router.post('/tournaments', async (req, res) => {
    const { division, registrationStart, registrationEnd, prizePool, status } = req.body;
    if (!division) return res.status(400).json({ error: 'division required' });

    const div = DIVISIONS.find(d => d.name === division);
    if (!div) return res.status(400).json({ error: 'Неизвестный дивизион' });

    // Проверяем, нет ли уже активного турнира в этом дивизионе
    const existing = db.prepare(
        "SELECT id FROM tournaments WHERE division = ? AND status IN ('registration', 'in_progress')"
    ).get(division) as any;
    if (existing) return res.status(400).json({ error: 'В этом дивизионе уже есть активный турнир' });

    const now = Math.floor(Date.now() / 1000);
    db.prepare(
        'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(division, status || 'registration', registrationStart || now, registrationEnd || (now + 86400), prizePool || div.basePool, now);

    res.json({ success: true });
});

// Обновить турнир
router.put('/tournaments/:id', async (req, res) => {
    const { division, status, registrationStart, registrationEnd, prizePool } = req.body;
    const id = req.params.id;

    const t = await db.oneOrNone('SELECT * FROM tournaments WHERE id = ?', [id]) as any;
    if (!t) return res.status(404).json({ error: 'Турнир не найден' });

    db.prepare(
        'UPDATE tournaments SET status=?, registrationStart=?, registrationEnd=?, prizePool=? WHERE id=?'
    ).run(
        status || t.status,
        registrationStart ?? t.registrationStart,
        registrationEnd ?? t.registrationEnd,
        prizePool ?? t.prizePool,
        id
    );

    res.json({ success: true });
});

// Удалить турнир
router.delete('/tournaments/:id', async (req, res) => {
    const id = req.params.id;
    await db.none('DELETE FROM tournament_participants WHERE tournamentId = ?', [id]);
    await db.none('DELETE FROM tournament_matches WHERE tournamentId = ?', [id]);
    await db.none('DELETE FROM tournaments WHERE id = ?', [id]);
    res.json({ success: true });
});

// Принудительно завершить турнир (сменить статус на completed)
router.post('/tournaments/:id/finish', async (req, res) => {
    const id = req.params.id;
    const t = await db.oneOrNone('SELECT * FROM tournaments WHERE id = ?', [id]) as any;
    if (!t) return res.status(404).json({ error: 'Турнир не найден' });
    await db.none('UPDATE tournaments SET status = ? WHERE id = ?', ['completed', id]);
    res.json({ success: true, message: `Турнир «${t.division}» завершён` });
});

// Запустить турнир (in_progress)
router.post('/tournaments/:id/start', async (req, res) => {
    const id = req.params.id;
    const t = await db.oneOrNone('SELECT * FROM tournaments WHERE id = ?', [id]) as any;
    if (!t) return res.status(404).json({ error: 'Турнир не найден' });
    await db.none('UPDATE tournaments SET status = ? WHERE id = ?', ['in_progress', id]);
    res.json({ success: true, message: `Турнир «${t.division}» запущен` });
});

export default router;
