import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index';
import { changeUsernameSchema, changePasswordSchema, registerGuestSchema } from '../validation';
import { auditPasswordChange, auditUsernameChange } from '../audit';
import { revokeToken } from '../tokenBlacklist';
import { JWT_SECRET } from '../env';

const router = Router();

router.post('/account/change-username', async (req, res) => {
    const parsed = changeUsernameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректное имя' });

    const userId = req.userId;
    const { newUsername } = parsed.data;

    const user = await db.one('SELECT passwordHash FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Проверяем текущий пароль
    const currentPassword = (req.body as any).currentPassword;
    if (currentPassword !== undefined) {
        if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
            return res.status(400).json({ error: 'Неверный текущий пароль' });
        }
    }

    const existing = await db.one('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, userId]);
    if (existing) return res.status(400).json({ error: 'Это имя уже занято' });

    const oldUser = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    await db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId]);
    if (oldUser) auditUsernameChange(userId, oldUser.username, newUsername, req.ip);
    res.json({ success: true, newUsername });
});

router.post('/account/change-gender', async (req, res) => {
    const userId = req.userId;
    const { gender } = req.body;
    if (!['male', 'female'].includes(gender)) return res.status(400).json({ error: 'Некорректный пол' });
    await db.run('UPDATE users SET gender = ? WHERE id = ?', [gender, userId]);
    res.json({ success: true, gender });
});

router.post('/account/change-password', async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const userId = req.userId;
    const { oldPassword, newPassword } = parsed.data;

    const user = await db.one('SELECT passwordHash FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (!bcrypt.compareSync(oldPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Неверный старый пароль' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, userId]);
    const u = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    if (u) auditPasswordChange(userId, u.username, req.ip);
    res.json({ success: true });
});

router.post('/account/delete', async (req, res) => {
    const userId = req.userId;
    const { currentPassword } = req.body;

    const user = await db.one('SELECT passwordHash, username, oauthProvider FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // VK пользователи не имеют пароля — удаляем без проверки
    if (user.oauthProvider !== 'vk') {
        if (!currentPassword || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
            return res.status(400).json({ error: 'Неверный пароль' });
        }
    }

    // Удаляем связанные данные
    await db.run('DELETE FROM battles WHERE attackerId = ? OR defenderId = ?', [userId, userId]);
    await db.run('DELETE FROM job_history WHERE userId = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    // Отзываем токен
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded: any = jwt.decode(token!);
            if (decoded?.jti && decoded?.exp) revokeToken(decoded.jti, decoded.exp);
        } catch {}
    }

    res.json({ success: true, message: 'Аккаунт удалён. Восстановить невозможно.' });
});

router.post('/account/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.decode(token!);
      if (decoded?.jti && decoded?.exp) {
        revokeToken(decoded.jti, decoded.exp);
      }
    } catch { /* игнорируем ошибки декодирования */ }
    res.json({ success: true });
});

// Регистрация из гостевого аккаунта
router.post('/account/register-guest', async (req, res) => {
    const userId = req.userId;
    if (!req.isGuest) return res.status(400).json({ error: 'Только для гостевых аккаунтов' });

    const parsed = registerGuestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });

    const { password, email, code } = parsed.data;

    const emailTaken = await db.one('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailTaken) return res.status(400).json({ error: 'Этот email уже используется' });

    // Проверяем код подтверждения email
    const now = Math.floor(Date.now() / 1000);
    const guestUser = await db.one('SELECT emailCode, emailCodeExpires, username FROM users WHERE id = ?', [userId]) as any;
    if (!guestUser?.emailCode || guestUser.emailCodeExpires < now) {
        return res.status(400).json({ error: 'Код подтверждения недействителен или истёк. Запросите новый.' });
    }
    if (guestUser.emailCode !== code) {
        return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const premiumUntil = now + 86400; // 1 день премиума за регистрацию
    await db.run('UPDATE users SET passwordHash = ?, email = ?, emailVerified = 1, emailCode = NULL, emailCodeExpires = 0, isGuest = 0, premiumUntil = ? WHERE id = ?',
        [passwordHash, email, premiumUntil, userId]);

    const token = jwt.sign({ userId, role: 'player', isGuest: false, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, username: guestUser.username });
});

// Загрузка аватара (base64)
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/avatars');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

router.post('/account/avatar', async (req, res) => {
    const userId = req.userId;
    const { avatar } = req.body; // data:image/webp;base64,...
    if (!avatar || typeof avatar !== 'string') return res.status(400).json({ error: 'Нет изображения' });

    const match = avatar.match(/^data:image\/(webp|png|jpeg|jpg);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Формат не поддерживается. Допустимы: webp, png, jpeg' });

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const data = match[2];
    const buffer = Buffer.from(data!, 'base64');
    if (buffer.length > 512 * 1024) return res.status(400).json({ error: 'Изображение слишком большое (макс. 512 КБ)' });

    const filename = `${userId}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

    const avatarPath = `/uploads/avatars/${filename}`;
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId]);
    res.json({ success: true, avatar: avatarPath });
});

router.get('/account/avatar/:userId', async (req, res) => {
    const user = await db.one('SELECT avatar FROM users WHERE id = ?', [parseInt(req.params.userId)]) as any;
    if (!user?.avatar) return res.status(404).json({ error: 'Нет аватара' });
    res.json({ avatar: user.avatar });
});

export default router;
