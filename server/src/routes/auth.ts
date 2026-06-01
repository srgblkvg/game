import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../database';
import { registerSchema, loginSchema } from '../validation';
import { JWT_SECRET } from '../env';
import { auditRegister, auditLoginSuccess, auditLoginFailure, auditAccountLocked } from '../audit';

const router = Router();


router.post('/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });

    const { username, password } = parsed.data;

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Пользователь уже существует' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const startHp = 5 + 5 + 5 + 5;
    const info = db.prepare('INSERT INTO users (username, passwordHash, currentHp, lastHpUpdate, level, gender) VALUES (?, ?, ?, ?, 1, \'male\')')
        .run(username, passwordHash, startHp, now);
    const userId = info.lastInsertRowid;

    const token = jwt.sign({ userId, role: 'player', jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });
    auditRegister(username, Number(userId), req.ip);
    res.json({ token, user: { id: userId, username, level: 1, role: 'player' } });
});

router.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { username, password } = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    // Проверяем блокировку пользователя
    const userRow: any = db.prepare('SELECT id, passwordHash, failedLogins, lockedUntil FROM users WHERE username = ?').get(username);
    if (userRow && userRow.lockedUntil > now) {
      const mins = Math.ceil((userRow.lockedUntil - now) / 60);
      auditAccountLocked(username, req.ip);
      return res.status(423).json({ error: `Аккаунт заблокирован. Попробуйте через ${mins} мин.` });
    }

    // Сначала ищем среди администраторов
    const admin: any = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (admin && bcrypt.compareSync(password, admin.passwordHash)) {
        const token = jwt.sign({ adminId: admin.id, role: 'admin', jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({ token, user: { id: admin.id, username: admin.username, level: 0, role: 'admin' } });
    }

    // Затем среди игроков
    if (!userRow || !bcrypt.compareSync(password, userRow.passwordHash)) {
        // Увеличиваем счётчик неудачных попыток
        if (userRow) {
          const newFailed = (userRow.failedLogins || 0) + 1;
          const lockedUntil = newFailed >= 5 ? now + 15 * 60 : 0;
          db.prepare('UPDATE users SET failedLogins = ?, lockedUntil = ? WHERE id = ?')
            .run(newFailed, lockedUntil, userRow.id);
          if (newFailed >= 5) auditAccountLocked(username, req.ip);
        }
        auditLoginFailure(username, req.ip);
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Успешный вход — сбрасываем счётчик
    db.prepare('UPDATE users SET failedLogins = 0, lockedUntil = 0 WHERE id = ?').run(userRow.id);
    auditLoginSuccess(username, userRow.id, req.ip);

    const token = jwt.sign({ userId: userRow.id, role: 'player', jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userRow.id, username: userRow.username, level: userRow.level, role: 'player' } });
});

export default router;