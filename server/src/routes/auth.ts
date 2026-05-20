import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database';
import { registerSchema, loginSchema } from '../validation';
import { JWT_SECRET } from '../env';

const router = Router();


router.post('/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });

    const { username, password } = parsed.data;

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Пользователь уже существует' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const startHp = 5 + 5 + 100 + 5 + 5;
    const info = db.prepare('INSERT INTO users (username, passwordHash, currentHp, lastHpUpdate, level, gender) VALUES (?, ?, ?, ?, 1, \'male\')')
        .run(username, passwordHash, startHp, now);
    const userId = info.lastInsertRowid;

    const token = jwt.sign({ userId, role: 'player' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, username, level: 1, role: 'player' } });
});

router.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { username, password } = parsed.data;

    // Сначала ищем среди администраторов
    const admin: any = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (admin && bcrypt.compareSync(password, admin.passwordHash)) {
        const token = jwt.sign({ adminId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({ token, user: { id: admin.id, username: admin.username, level: 0, role: 'admin' } });
    }

    // Затем среди игроков
    const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = jwt.sign({ userId: user.id, role: 'player' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, level: user.level, role: 'player' } });
});

export default router;