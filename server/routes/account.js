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
const logger_1 = __importDefault(require("../logger"));
const validation_1 = require("../validation");
const audit_1 = require("../audit");
const tokenBlacklist_1 = require("../tokenBlacklist");
const env_1 = require("../env");
const router = (0, express_1.Router)();
router.post('/account/change-username', async (req, res) => {
    const parsed = validation_1.changeUsernameSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректное имя' });
    const userId = req.userId;
    const { newUsername } = parsed.data;
    const user = await index_1.db.one('SELECT passwordHash FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    // Проверяем текущий пароль
    const currentPassword = req.body.currentPassword;
    if (currentPassword !== undefined) {
        if (!bcryptjs_1.default.compareSync(currentPassword, user.passwordHash)) {
            return res.status(400).json({ error: 'Неверный текущий пароль' });
        }
    }
    const existing = await index_1.db.one('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, userId]);
    if (existing)
        return res.status(400).json({ error: 'Это имя уже занято' });
    const oldUser = await index_1.db.one('SELECT username FROM users WHERE id = ?', [userId]);
    await index_1.db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId]);
    if (oldUser)
        (0, audit_1.auditUsernameChange)(userId, oldUser.username, newUsername, req.ip);
    res.json({ success: true, newUsername });
});
router.post('/account/change-gender', async (req, res) => {
    const userId = req.userId;
    const { gender } = req.body;
    if (!['male', 'female'].includes(gender))
        return res.status(400).json({ error: 'Некорректный пол' });
    await index_1.db.run('UPDATE users SET gender = ? WHERE id = ?', [gender, userId]);
    res.json({ success: true, gender });
});
router.post('/account/change-password', async (req, res) => {
    const parsed = validation_1.changePasswordSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const userId = req.userId;
    const { oldPassword, newPassword } = parsed.data;
    const user = await index_1.db.one('SELECT passwordHash FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    if (!bcryptjs_1.default.compareSync(oldPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Неверный старый пароль' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(newPassword, 10);
    await index_1.db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, userId]);
    const u = await index_1.db.one('SELECT username FROM users WHERE id = ?', [userId]);
    if (u)
        (0, audit_1.auditPasswordChange)(userId, u.username, req.ip);
    res.json({ success: true });
});
router.post('/account/delete', async (req, res) => {
    const userId = req.userId;
    const { currentPassword } = req.body;
    const user = await index_1.db.one('SELECT passwordHash, username, oauthProvider FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    // VK пользователи не имеют пароля — удаляем без проверки
    if (user.oauthProvider !== 'vk') {
        if (!currentPassword || !bcryptjs_1.default.compareSync(currentPassword, user.passwordHash)) {
            return res.status(400).json({ error: 'Неверный пароль' });
        }
    }
    // Передаём лидерство если лидер гильдии
    const leaderGuild = await index_1.db.one('SELECT guildId FROM guild_members WHERE userId = ? AND rank = ?', [userId, 'leader']);
    if (leaderGuild) {
        // Ищем преемника: офицер с max lastLoginAt, если нет — участник с max lastLoginAt
        let successor = await index_1.db.one(`
        SELECT gm.userId FROM guild_members gm
        JOIN users u ON gm.userId = u.id
        WHERE gm.guildId = ? AND gm.rank = 'officer' AND gm.userId != ?
        ORDER BY u.lastLoginAt DESC NULLS LAST LIMIT 1
      `, [leaderGuild.guildId, userId]);
        if (!successor) {
            successor = await index_1.db.one(`
          SELECT gm.userId FROM guild_members gm
          JOIN users u ON gm.userId = u.id
          WHERE gm.guildId = ? AND gm.userId != ?
          ORDER BY u.lastLoginAt DESC NULLS LAST LIMIT 1
        `, [leaderGuild.guildId, userId]);
        }
        if (successor) {
            await index_1.db.run('UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?', ['leader', leaderGuild.guildId, successor.userId]);
            logger_1.default.info(`[Account Delete] Leadership of guild ${leaderGuild.guildId} transferred from ${userId} to ${successor.userId}`);
        }
    }
    // Удаляем связанные данные
    await index_1.db.run('DELETE FROM guild_members WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM guild_invites WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM battles WHERE attackerId = ? OR defenderId = ?', [userId, userId]);
    await index_1.db.run('DELETE FROM job_history WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM users WHERE id = ?', [userId]);
    // Отзываем токен
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (decoded?.jti && decoded?.exp)
                (0, tokenBlacklist_1.revokeToken)(decoded.jti, decoded.exp);
        }
        catch { }
    }
    res.json({ success: true, message: 'Аккаунт удалён. Восстановить невозможно.' });
});
router.post('/account/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Не авторизован' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (decoded?.jti && decoded?.exp) {
            (0, tokenBlacklist_1.revokeToken)(decoded.jti, decoded.exp);
        }
    }
    catch { /* игнорируем ошибки декодирования */ }
    res.json({ success: true });
});
// Регистрация из гостевого аккаунта
router.post('/account/register-guest', async (req, res) => {
    const userId = req.userId;
    if (!req.isGuest)
        return res.status(400).json({ error: 'Только для гостевых аккаунтов' });
    const parsed = validation_1.registerGuestSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });
    const { password, email: rawEmail, code } = parsed.data;
    const email = rawEmail.toLowerCase().trim();
    const emailTaken = await index_1.db.one('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailTaken)
        return res.status(400).json({ error: 'Этот email уже используется' });
    // Проверяем код подтверждения email
    const now = Math.floor(Date.now() / 1000);
    const guestUser = await index_1.db.one('SELECT emailCode, emailCodeExpires, username FROM users WHERE id = ?', [userId]);
    if (!guestUser?.emailCode || guestUser.emailCodeExpires < now) {
        return res.status(400).json({ error: 'Код подтверждения недействителен или истёк. Запросите новый.' });
    }
    if (String(guestUser.emailCode) !== String(code)) {
        logger_1.default.warn({ userId, email, expectedCode: String(guestUser.emailCode), receivedCode: String(code) }, 'Guest registration: wrong code');
        return res.status(400).json({ error: 'Неверный код подтверждения' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const premiumUntil = now + 86400; // 1 день премиума за регистрацию
    await index_1.db.run('UPDATE users SET passwordHash = ?, email = ?, emailVerified = 1, emailCode = NULL, emailCodeExpires = 0, isGuest = 0, premiumUntil = ? WHERE id = ?', [passwordHash, email, premiumUntil, userId]);
    const token = jsonwebtoken_1.default.sign({ userId, role: 'player', isGuest: false, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, username: guestUser.username });
});
// Загрузка аватара (base64)
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const UPLOADS_DIR = path_1.default.resolve(__dirname, '../../uploads/avatars');
fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
router.post('/account/avatar', async (req, res) => {
    const userId = req.userId;
    const { avatar } = req.body; // data:image/webp;base64,...
    if (!avatar || typeof avatar !== 'string')
        return res.status(400).json({ error: 'Нет изображения' });
    const match = avatar.match(/^data:image\/(webp|png|jpeg|jpg);base64,(.+)$/);
    if (!match)
        return res.status(400).json({ error: 'Формат не поддерживается. Допустимы: webp, png, jpeg' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const data = match[2];
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > 512 * 1024)
        return res.status(400).json({ error: 'Изображение слишком большое (макс. 512 КБ)' });
    const filename = `${userId}_${Date.now()}.${ext}`;
    // Удаляем старый аватар
    try {
        const oldUser = await index_1.db.one('SELECT avatar FROM users WHERE id = ?', [userId]);
        if (oldUser?.avatar) {
            const oldFile = path_1.default.join(UPLOADS_DIR, path_1.default.basename(oldUser.avatar));
            if (fs_1.default.existsSync(oldFile))
                fs_1.default.unlinkSync(oldFile);
        }
    }
    catch { }
    fs_1.default.writeFileSync(path_1.default.join(UPLOADS_DIR, filename), buffer);
    const avatarPath = `/uploads/avatars/${filename}`;
    await index_1.db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId]);
    res.json({ success: true, avatar: avatarPath });
});
router.get('/account/avatar/:userId', async (req, res) => {
    const user = await index_1.db.one('SELECT avatar FROM users WHERE id = ?', [parseInt(req.params.userId)]);
    if (!user?.avatar)
        return res.status(404).json({ error: 'Нет аватара' });
    res.json({ avatar: user.avatar });
});
exports.default = router;
//# sourceMappingURL=account.js.map