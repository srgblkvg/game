"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../db/index");
const validation_1 = require("../validation");
const env_1 = require("../env");
const audit_1 = require("../audit");
const email_1 = require("../email");
const rating_1 = require("../game/rating");
const stats_1 = require("../game/stats");
const helpers_1 = require("../db/helpers");
const logger_1 = __importDefault(require("../logger"));
const router = (0, express_1.Router)();
function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
router.post('/register', async (req, res) => {
    const parsed = validation_1.registerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });
    const { username, email: rawEmail, password } = parsed.data;
    const email = rawEmail.toLowerCase().trim();
    const existing = await index_1.db.one('SELECT id, username FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
        if (existing.username === username) {
            return res.status(400).json({ error: 'Имя или email уже зарегистрированы' });
        }
        return res.status(400).json({ error: 'Имя или email уже зарегистрированы' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const startHp = (0, stats_1.currentStats)({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
    const code = generateCode();
    const codeExpires = now + 600; // 10 минут
    const equipment1 = (0, helpers_1.getStarterEquipment)();
    const eqObj = JSON.parse(equipment1);
    await index_1.db.raw(`INSERT INTO users (username, passwordhash, email, emailcode, emailcodeexpires, currenthp, lasthpupdate, level, gender, money, equipment_1)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'male', $8, $9) RETURNING id`, [username, passwordHash, email, code, codeExpires, startHp, now, 1000, eqObj]);
    const sent = await (0, email_1.sendVerificationCode)(email, code);
    if (!sent) {
        // Письмо не ушло — пользователь создан, но потребует подтверждения при входе
        // Удаляем код (нельзя подтвердить без письма) — пусть запросит повторно через resend-code
        await index_1.db.run('UPDATE users SET emailCode = NULL, emailCodeExpires = 0 WHERE email = ?', [email]);
        return res.status(500).json({ error: 'Не удалось отправить письмо с кодом. Попробуйте позже или запросите код повторно на странице входа.' });
    }
    res.json({ message: 'Код подтверждения отправлен на почту' });
});
router.post('/verify-email', async (req, res) => {
    const parsed = validation_1.verifyEmailSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { email: rawEmail, code } = parsed.data;
    const email = rawEmail.toLowerCase().trim();
    const now = Math.floor(Date.now() / 1000);
    const user = await index_1.db.one('SELECT id, username, emailCode, emailCodeExpires, emailVerified FROM users WHERE email = ?', [email]);
    if (!user)
        return res.status(400).json({ error: 'Email не найден' });
    if (user.emailVerified)
        return res.status(400).json({ error: 'Email уже подтверждён' });
    if (!user.emailCode || user.emailCodeExpires < now)
        return res.status(400).json({ error: 'Код истёк. Запросите новый.' });
    if (String(user.emailCode) !== String(code)) {
        logger_1.default.warn({ email, expectedCode: String(user.emailCode), receivedCode: String(code) }, 'Email verification: wrong code');
        return res.status(400).json({ error: 'Неверный код' });
    }
    await index_1.db.run('UPDATE users SET emailVerified = 1, emailCode = NULL, emailCodeExpires = 0, lastLoginAt = ? WHERE id = ?', [now, user.id]);
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: 'player', jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
    (0, audit_1.auditRegister)(user.username, user.id, req.ip);
    res.json({ token, user: { id: user.id, username: user.username, level: 1, role: 'player' } });
});
// Повторная отправка кода подтверждения
router.post('/resend-code', async (req, res) => {
    const rawEmail = (req.body.email || '').trim();
    const email = rawEmail.toLowerCase();
    if (!email)
        return res.status(400).json({ error: 'Email обязателен' });
    const now = Math.floor(Date.now() / 1000);
    // Если запрос от гостя (авторизован) — записываем email и код на его же запись
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            if (!token)
                return res.status(400).json({ error: 'Невалидный токен' });
            const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
            if (decoded.isGuest && decoded.userId) {
                const guestUser = await index_1.db.one('SELECT id FROM users WHERE id = ?', [decoded.userId]);
                if (guestUser) {
                    // Проверяем, не занят ли email другим пользователем
                    const emailTaken = await index_1.db.one('SELECT id FROM users WHERE email = ? AND id != ?', [email, decoded.userId]);
                    if (emailTaken)
                        return res.status(400).json({ error: 'Этот email уже используется' });
                    const code = generateCode();
                    const codeExpires = now + 600;
                    await index_1.db.run('UPDATE users SET email = ?, emailCode = ?, emailCodeExpires = ? WHERE id = ?', [email, code, codeExpires, decoded.userId]);
                    const sent = await (0, email_1.sendVerificationCode)(email, code);
                    if (!sent)
                        return res.status(500).json({ error: 'Не удалось отправить код. Попробуйте позже.' });
                    return res.json({ message: 'Код отправлен на почту' });
                }
            }
        }
        catch { /* токен невалидный или не гостевой — идём по обычному пути */ }
    }
    // Обычный путь — поиск по email
    const user = await index_1.db.one('SELECT id, emailVerified FROM users WHERE email = ?', [email]);
    if (!user)
        return res.status(400).json({ error: 'Email не найден' });
    if (user.emailVerified)
        return res.status(400).json({ error: 'Email уже подтверждён' });
    const code = generateCode();
    const codeExpires = now + 600;
    await index_1.db.run('UPDATE users SET emailCode = ?, emailCodeExpires = ? WHERE id = ?', [code, codeExpires, user.id]);
    const sent = await (0, email_1.sendVerificationCode)(email, code);
    if (!sent)
        return res.status(500).json({ error: 'Не удалось отправить код. Попробуйте позже.' });
    res.json({ message: 'Код отправлен повторно' });
});
// Гостевой вход — без регистрации, ограниченный доступ
router.post('/guest', async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const nickname = (req.body?.nickname || '').trim();
    if (nickname) {
        const existingUser = await index_1.db.one('SELECT id, isGuest FROM users WHERE username = ?', [nickname]).catch(() => null);
        if (existingUser) {
            if (!existingUser.isGuest)
                return res.status(400).json({ error: 'Этот никнейм уже занят зарегистрированным пользователем' });
            // Гость с таким ником — входим в существующий аккаунт
            const token = jsonwebtoken_1.default.sign({ userId: existingUser.id, role: 'player', isGuest: true, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
            (0, audit_1.auditLoginSuccess)(nickname, existingUser.id, req.ip);
            return res.json({ token, user: { id: existingUser.id, username: nickname, level: 1, role: 'player', isGuest: true, gender: 'male' } });
        }
    }
    const guestId = nickname || `Гость_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const startHp = (0, stats_1.currentStats)({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
    const equipment1 = (0, helpers_1.getStarterEquipment)();
    const eqObj = JSON.parse(equipment1);
    const insertResult = await index_1.db.raw(`INSERT INTO users (username, passwordhash, currenthp, lasthpupdate, level, gender, isguest, emailverified, exp, money, equipment_1)
        VALUES ($1, '', $2, $3, 1, 'male', 1, 1, 0, $4, $5) RETURNING id`, [guestId, startHp, now, 1000, eqObj]);
    const newUserId = insertResult.rows[0].id;
    const token = jsonwebtoken_1.default.sign({ userId: newUserId, role: 'player', isGuest: true, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
    (0, audit_1.auditLoginSuccess)(guestId, newUserId, req.ip);
    if (req.ip) {
        try {
            await index_1.db.run('INSERT INTO login_logs (userId, ip) VALUES (?, ?)', [newUserId, req.ip]);
        }
        catch { }
    }
    res.json({ token, user: { id: newUserId, username: guestId, level: 1, role: 'player', isGuest: true, gender: 'male' } });
});
router.post('/login', async (req, res) => {
    const parsed = validation_1.loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { username, password } = parsed.data;
    const login = username.includes('@') ? username.toLowerCase().trim() : username; // может быть email или username
    const now = Math.floor(Date.now() / 1000);
    // Ищем пользователя по email или username
    const userRow = await index_1.db.one('SELECT id, passwordHash, failedLogins, lockedUntil, bannedUntil FROM users WHERE username = ? OR email = ?', [login, login]);
    if (userRow && userRow.lockedUntil > now) {
        const mins = Math.ceil((userRow.lockedUntil - now) / 60);
        (0, audit_1.auditAccountLocked)(login, req.ip);
        return res.status(423).json({ error: `Аккаунт заблокирован. Попробуйте через ${mins} мин.` });
    }
    // Проверка бана от админа
    if (userRow && userRow.bannedUntil > now) {
        const remaining = userRow.bannedUntil - now;
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        const parts = [];
        if (days > 0)
            parts.push(`${days} дн.`);
        if (hours > 0)
            parts.push(`${hours} ч.`);
        if (mins > 0)
            parts.push(`${mins} мин.`);
        return res.status(423).json({ error: `Вы забанены. Осталось: ${parts.join(' ')}` });
    }
    // Сначала ищем среди администраторов
    const admin = await index_1.db.one('SELECT * FROM admins WHERE username = ?', [login]);
    if (admin && bcryptjs_1.default.compareSync(password, admin.passwordHash)) {
        const token = jsonwebtoken_1.default.sign({ adminId: admin.id, role: 'admin', jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: admin.id, username: admin.username, level: 0, role: 'admin' } });
    }
    // Затем среди игроков
    if (!userRow || !bcryptjs_1.default.compareSync(password, userRow.passwordHash)) {
        // Увеличиваем счётчик неудачных попыток
        if (userRow) {
            const newFailed = (userRow.failedLogins || 0) + 1;
            const lockedUntil = newFailed >= 5 ? now + 15 * 60 : 0;
            await index_1.db.run('UPDATE users SET failedLogins = ?, lockedUntil = ? WHERE id = ?', [newFailed, lockedUntil, userRow.id]);
            if (newFailed >= 5)
                (0, audit_1.auditAccountLocked)(login, req.ip);
        }
        (0, audit_1.auditLoginFailure)(login, req.ip);
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    // Успешный вход — проверяем подтверждение почты (только если email указан)
    const emailUser = await index_1.db.one('SELECT email, emailVerified FROM users WHERE id = ?', [userRow.id]);
    if (emailUser?.email && !emailUser.emailVerified) {
        return res.status(403).json({ error: 'Почта не подтверждена. Проверьте email для кода подтверждения.', email: emailUser.email });
    }
    // Сбрасываем счётчик неудачных попыток
    await index_1.db.run('UPDATE users SET failedLogins = 0, lockedUntil = 0, lastLoginAt = ? WHERE id = ?', [now, userRow.id]);
    (0, audit_1.auditLoginSuccess)(login, userRow.id, req.ip);
    // Декай рейтинга
    const ratingUser = await index_1.db.one('SELECT elo, lastPvpTime FROM users WHERE id = ?', [userRow.id]);
    if (ratingUser) {
        (0, rating_1.applyDecay)(userRow.id, ratingUser.lastPvpTime || 0, ratingUser.elo || 1000);
    }
    // Логируем IP
    if (req.ip) {
        try {
            await index_1.db.run('INSERT INTO login_logs (userId, ip) VALUES (?, ?)', [userRow.id, req.ip]);
        }
        catch { }
    }
    const token = jsonwebtoken_1.default.sign({ userId: userRow.id, role: 'player', jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
    const fullUser = await index_1.db.one('SELECT gender FROM users WHERE id = ?', [userRow.id]);
    res.json({ token, user: { id: userRow.id, username: userRow.username, level: userRow.level, role: 'player', gender: fullUser?.gender || 'male' } });
});
exports.default = router;
//# sourceMappingURL=auth.js.map