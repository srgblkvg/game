import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../database';
import { registerSchema, loginSchema, verifyEmailSchema } from '../validation';
import { JWT_SECRET } from '../env';
import { auditRegister, auditLoginSuccess, auditLoginFailure, auditAccountLocked } from '../audit';
import { sendVerificationCode } from '../email';
import { applyDecay, checkSeasonReset } from '../game/rating';
import { currentStats } from '../game/stats';

const router = Router();

async function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });

    const { username, email, password } = parsed.data;

    const existing = await db.prepare('SELECT id, username FROM users WHERE username = ? OR email = ?').get(username, email) as any;
    if (existing) {
        if (existing.username === username) {
            return res.status(400).json({ error: 'Имя или email уже зарегистрированы' });
        }
        return res.status(400).json({ error: 'Имя или email уже зарегистрированы' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const startHp = currentStats({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
    const code = generateCode();
    const codeExpires = now + 600; // 10 минут

    await db.prepare(`INSERT INTO users (username, passwordHash, email, emailCode, emailCodeExpires, currentHp, lastHpUpdate, level, gender)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'male')`).run(username, passwordHash, email, code, codeExpires, startHp, now);

    const sent = await sendVerificationCode(email, code);
    if (!sent) {
        // Письмо не ушло — пользователь создан, но потребует подтверждения при входе
        // Удаляем код (нельзя подтвердить без письма) — пусть запросит повторно через resend-code
        await db.prepare('UPDATE users SET emailCode = NULL, emailCodeExpires = 0 WHERE email = ?').run(email);
        return res.status(500).json({ error: 'Не удалось отправить письмо с кодом. Попробуйте позже или запросите код повторно на странице входа.' });
    }

    res.json({ message: 'Код подтверждения отправлен на почту' });
});

router.post('/verify-email', async (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { email, code } = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    const user: any = await db.prepare('SELECT id, username, emailCode, emailCodeExpires, emailVerified FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: 'Email не найден' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email уже подтверждён' });
    if (user.emailCode !== code) return res.status(400).json({ error: 'Неверный код' });
    if (user.emailCodeExpires < now) return res.status(400).json({ error: 'Код истёк. Запросите новый.' });

    await db.prepare('UPDATE users SET emailVerified = 1, emailCode = NULL, emailCodeExpires = 0, lastLoginAt = ? WHERE id = ?').run(now, user.id);

    const token = jwt.sign({ userId: user.id, role: 'player', jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });
    auditRegister(user.username, user.id, req.ip);
    res.json({ token, user: { id: user.id, username: user.username, level: 1, role: 'player' } });
});

// Повторная отправка кода подтверждения
router.post('/resend-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email обязателен' });

    const now = Math.floor(Date.now() / 1000);

    // Если запрос от гостя (авторизован) — записываем email и код на его же запись
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            if (!token) return res.status(400).json({ error: 'Невалидный токен' });
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.isGuest && decoded.userId) {
                const guestUser: any = await db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.userId);
                if (guestUser) {
                    // Проверяем, не занят ли email другим пользователем
                    const emailTaken = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, decoded.userId);
                    if (emailTaken) return res.status(400).json({ error: 'Этот email уже используется' });

                    const code = generateCode();
                    const codeExpires = now + 600;
                    await db.prepare('UPDATE users SET email = ?, emailCode = ?, emailCodeExpires = ? WHERE id = ?').run(email, code, codeExpires, decoded.userId);

                    const sent = await sendVerificationCode(email, code);
                    if (!sent) return res.status(500).json({ error: 'Не удалось отправить код. Попробуйте позже.' });

                    return res.json({ message: 'Код отправлен на почту' });
                }
            }
        } catch { /* токен невалидный или не гостевой — идём по обычному пути */ }
    }

    // Обычный путь — поиск по email
    const user: any = await db.prepare('SELECT id, emailVerified FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: 'Email не найден' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email уже подтверждён' });

    const code = generateCode();
    const codeExpires = now + 600;
    await db.prepare('UPDATE users SET emailCode = ?, emailCodeExpires = ? WHERE id = ?').run(code, codeExpires, user.id);

    const sent = await sendVerificationCode(email, code);
    if (!sent) return res.status(500).json({ error: 'Не удалось отправить код. Попробуйте позже.' });

    res.json({ message: 'Код отправлен повторно' });
});

// Гостевой вход — без регистрации, ограниченный доступ
router.post('/guest', async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const guestId = `Гость_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const startHp = currentStats({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;

    await db.prepare(`INSERT INTO users (username, passwordHash, currentHp, lastHpUpdate, level, gender, isGuest, emailVerified, exp, money)
        VALUES (?, '', ?, ?, 1, 'male', 1, 1, 0, 0)`).run(guestId, startHp, now);

    const user: any = await db.prepare('SELECT id FROM users WHERE username = ?').get(guestId);
    const token = jwt.sign({ userId: user.id, role: 'player', isGuest: true, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });

    auditLoginSuccess(guestId, user.id, req.ip);
    if (req.ip) {
        await db.prepare('INSERT INTO login_logs (userId, ip) VALUES (?, ?)').run(user.id, req.ip);
    }

    res.json({ token, user: { id: user.id, username: guestId, level: 1, role: 'player', isGuest: true, gender: 'male' } });
});

router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { username, password } = parsed.data;
    const login = username; // может быть email или username
    const now = Math.floor(Date.now() / 1000);

    // Ищем пользователя по email или username
    const userRow: any = await db.prepare('SELECT id, passwordHash, failedLogins, lockedUntil, bannedUntil FROM users WHERE username = ? OR email = ?').get(login, login);
    
    // DEBUG: возвращаем инфу в ответе
    return res.json({ 
      debug: true,
      userFound: !!userRow, 
      keys: userRow ? Object.keys(userRow).filter(k => k.length < 25) : [],
      hasPasswordHash: !!userRow?.passwordHash,
      hasPasswordhash: !!userRow?.passwordhash,
      hashType: typeof userRow?.passwordHash,
      hashLen: userRow?.passwordHash?.length
    });
    if (userRow && userRow.lockedUntil > now) {
      const mins = Math.ceil((userRow.lockedUntil - now) / 60);
      auditAccountLocked(login, req.ip);
      return res.status(423).json({ error: `Аккаунт заблокирован. Попробуйте через ${mins} мин.` });
    }

    // Проверка бана от админа
    if (userRow && userRow.bannedUntil > now) {
      const remaining = userRow.bannedUntil - now;
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const parts = [];
      if (days > 0) parts.push(`${days} дн.`);
      if (hours > 0) parts.push(`${hours} ч.`);
      if (mins > 0) parts.push(`${mins} мин.`);
      return res.status(423).json({ error: `Вы забанены. Осталось: ${parts.join(' ')}` });
    }

    // Сначала ищем среди администраторов
    const admin: any = await db.prepare('SELECT * FROM admins WHERE username = ?').get(login);
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
          await db.prepare('UPDATE users SET failedLogins = ?, lockedUntil = ? WHERE id = ?').run(newFailed, lockedUntil, userRow.id);
          if (newFailed >= 5) auditAccountLocked(login, req.ip);
        }
        auditLoginFailure(login, req.ip);
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Успешный вход — проверяем подтверждение почты (только если email указан)
    const emailUser: any = await db.prepare('SELECT email, emailVerified FROM users WHERE id = ?').get(userRow.id);
    if (emailUser?.email && !emailUser.emailVerified) {
        return res.status(403).json({ error: 'Почта не подтверждена. Проверьте email для кода подтверждения.', email: emailUser.email });
    }

    // Сбрасываем счётчик неудачных попыток
    await db.prepare('UPDATE users SET failedLogins = 0, lockedUntil = 0, lastLoginAt = ? WHERE id = ?').run(now, userRow.id);
    auditLoginSuccess(login, userRow.id, req.ip);

    // Декай рейтинга и проверка сезона
    const ratingUser: any = await db.prepare('SELECT elo, lastPvpTime FROM users WHERE id = ?').get(userRow.id);
    if (ratingUser) {
        applyDecay(db, userRow.id, ratingUser.lastPvpTime || 0, ratingUser.elo || 1000);
    }
    checkSeasonReset(db);

    // Логируем IP
    if (req.ip) {
        await db.prepare('INSERT INTO login_logs (userId, ip) VALUES (?, ?)').run(userRow.id, req.ip);
    }

    const token = jwt.sign({ userId: userRow.id, role: 'player', jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });
    const fullUser: any = await db.prepare('SELECT gender FROM users WHERE id = ?').get(userRow.id);
    res.json({ token, user: { id: userRow.id, username: userRow.username, level: userRow.level, role: 'player', gender: fullUser?.gender || 'male' } });
});

export default router;
