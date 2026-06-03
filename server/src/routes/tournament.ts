import { Router } from 'express';
import db from '../database';
import { runBattle } from '../game/battle';
import { getBaseStats, enrichEquipment } from '../db/helpers';

const router = Router();

const divisions = [
    { name: 'copper', label: 'Медный', minLevel: 1, maxLevel: 15, basePool: 500, icon: '🥉' },
    { name: 'steel', label: 'Стальной', minLevel: 16, maxLevel: 35, basePool: 2000, icon: '🥈' },
    { name: 'mithril', label: 'Мифриловый', minLevel: 36, maxLevel: 60, basePool: 8000, icon: '🥇' },
    { name: 'adamant', label: 'Адамантовый', minLevel: 61, maxLevel: 999, basePool: 25000, icon: '👑' },
];

function getOrCreateTournament() {
    const now = Math.floor(Date.now() / 1000);
    // Ищем активный турнир
    let tournaments = db.prepare('SELECT * FROM tournaments WHERE registrationEnd > ? ORDER BY id DESC').all(now) as any[];

    if (tournaments.length === 0) {
        // Создаём новый турнир на ближайшее воскресенье
        const day = new Date().getDay(); // 0=Sun
        const daysUntilSunday = day === 0 ? 7 : 7 - day;
        const nextSunday = new Date();
        nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
        nextSunday.setHours(13, 0, 0, 0);
        const regEnd = Math.floor(nextSunday.getTime() / 1000);
        const regStart = regEnd - 37 * 3600; // Сб 00:00

        const stmt = db.prepare('INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
        for (const div of divisions) {
            stmt.run(div.name, 'registration', regStart, regEnd, div.basePool, now);
        }
        tournaments = db.prepare('SELECT * FROM tournaments WHERE registrationEnd > ? ORDER BY id DESC').all(now) as any[];
    }

    return tournaments;
}

// Статус турнира
router.get('/tournament', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT level FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tournaments = getOrCreateTournament();
    const now = Math.floor(Date.now() / 1000);

    const result = tournaments.map((t: any) => {
        const participants = db.prepare('SELECT u.username, tp.* FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ?').all(t.id) as any[];
        const myReg = participants.find((p: any) => p.userId === userId);
        const matches = db.prepare('SELECT * FROM tournament_matches WHERE tournamentId = ? ORDER BY round, id').all(t.id) as any[];

        return {
            ...t,
            participantCount: participants.length,
            participants: participants.map((p: any) => ({ id: p.userId, username: p.username, goldenTicket: p.goldenTicket })),
            myRegistration: myReg || null,
            matches: matches.map((m: any) => ({ ...m, log: m.log ? JSON.parse(m.log) : null })),
        };
    });

    res.json({ tournaments: result, userLevel: user.level });
});

// Регистрация
router.post('/tournament/register', (req: any, res) => {
    const userId = req.userId;
    const { division, goldenTicket } = req.body;

    const user = db.prepare('SELECT level, money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const div = divisions.find(d => d.name === division);
    if (!div) return res.status(400).json({ error: 'Неизвестный дивизион' });
    if (user.level < div.minLevel || user.level > div.maxLevel) {
        return res.status(400).json({ error: `Ваш уровень не подходит для дивизиона «${div.label}»` });
    }

    const tournament = db.prepare('SELECT * FROM tournaments WHERE division = ? AND status = ?').get(division, 'registration') as any;
    if (!tournament) return res.status(400).json({ error: 'Регистрация закрыта' });

    const existing = db.prepare('SELECT id FROM tournament_participants WHERE tournamentId = ? AND userId = ?').get(tournament.id, userId) as any;
    if (existing) return res.status(400).json({ error: 'Вы уже зарегистрированы' });

    if (goldenTicket) {
        if (user.money < 1000) return res.status(400).json({ error: 'Недостаточно монет для Золотого билета (1000 🥇)' });
        db.prepare('UPDATE users SET money = money - 1000 WHERE id = ?').run(userId);
        db.prepare('UPDATE tournaments SET prizePool = prizePool + 800 WHERE id = ?').run(tournament.id);
    }

    db.prepare('INSERT INTO tournament_participants (tournamentId, userId, goldenTicket) VALUES (?, ?, ?)')
        .run(tournament.id, userId, goldenTicket ? 1 : 0);

    res.json({ success: true });
});

export default router;
