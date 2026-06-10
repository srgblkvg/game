import { Router } from 'express';
import db from '../database';

const router = Router();

// Звания по ELO
function getRank(elo: number): { name: string; icon: string; color: string } {
    if (elo >= 2100) return { name: 'Смерть', icon: '👑', color: '#ff4040' };
    if (elo >= 1900) return { name: 'Вечность', icon: '♦♦♦', color: '#20c0c0' };
    if (elo >= 1700) return { name: 'Бездна', icon: '♦♦', color: '#c02020' };
    if (elo >= 1500) return { name: 'Погибель', icon: '♦', color: '#c08020' };
    if (elo >= 1300) return { name: 'Кошмар', icon: '▪▪▪', color: '#7b208b' };
    if (elo >= 1100) return { name: 'Кровь', icon: '▪▪', color: '#8b3030' };
    if (elo >= 900) return { name: 'Тень', icon: '▪', color: '#5a5a8b' };
    if (elo >= 600) return { name: 'Шёпот', icon: '•••', color: '#6b8b6b' };
    if (elo >= 300) return { name: 'Кость', icon: '••', color: '#a09080' };
    return { name: 'Пепел', icon: '•', color: '#6b6b6b' };
}

// Рейтинг игроков (по ELO)
router.get('/rating', (req: any, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM users WHERE id > 0').get() as any).cnt;
    const users = db.prepare(`
        SELECT u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses, g.name as guildName, u.guildId
        FROM users u
        LEFT JOIN guilds g ON u.guildId = g.id
        WHERE u.id > 0
        ORDER BY u.elo DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const result = users.map((u: any) => ({
        ...u,
        elo: u.elo || 1000,
        rank: getRank(u.elo || 1000),
    }));

    res.json({ users: result, total });
});

// Позиция текущего игрока в рейтинге
router.get('/my-position', (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const user = db.prepare('SELECT elo FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });

    const elo = user.elo || 1000;
    const position = (db.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE id > 0 AND (elo > ? OR (elo = ? AND id < ?))'
    ).get(elo, elo, userId) as any).cnt + 1;

    res.json({ position });
});

export default router;
