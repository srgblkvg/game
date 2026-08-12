"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../db/index");
const env_1 = require("../env");
const logger_1 = __importDefault(require("../logger"));
const audit_1 = require("../audit");
const stats_1 = require("../game/stats");
const helpers_1 = require("../db/helpers");
const router = (0, express_1.Router)();
const VK_APP_SECRET = process.env.VK_APP_SECRET || '';
const VK_SERVICE_KEY = process.env.VK_SERVICE_KEY || process.env.VK_CLIENT_SECRET || VK_APP_SECRET;
// Проверка подписи параметров запуска VK
// Алгоритм: HMAC-SHA256(защищённый_ключ, query_string_без_sign) → URL-safe base64
function verifyLaunchParams(launchParams, sign) {
    if (!VK_APP_SECRET)
        return false;
    try {
        // Убираем &sign=... из строки запроса
        const cleanQuery = launchParams
            .split('&')
            .filter(p => !p.startsWith('sign='))
            .join('&');
        const hmac = crypto_1.default.createHmac('sha256', VK_APP_SECRET).update(cleanQuery).digest();
        const computed = hmac.toString('base64url').replace(/=+$/, '');
        return computed === sign;
    }
    catch {
        return false;
    }
}
// POST /api/auth/vk-bridge — вход через параметры запуска VK
router.post('/vk-bridge', async (req, res) => {
    const { vkUserId, sign, launchParams, vkUserInfo, linkToken } = req.body;
    if (!vkUserId || !sign) {
        return res.status(400).json({ error: 'Нет параметров запуска VK' });
    }
    // Проверяем подпись параметров запуска
    if (!verifyLaunchParams(launchParams || '', sign)) {
        logger_1.default.warn(`[VK Bridge Auth] Invalid launch signature for user ${vkUserId}`);
        return res.status(401).json({ error: 'Недействительная подпись запуска' });
    }
    try {
        const now = Math.floor(Date.now() / 1000);
        // Если передан linkToken — привязываем VK к существующему аккаунту
        if (linkToken) {
            try {
                const linkDecoded = jsonwebtoken_1.default.verify(linkToken, env_1.JWT_SECRET);
                if (linkDecoded.userId) {
                    const linkUser = await index_1.db.one('SELECT id, username, level FROM users WHERE id = ?', [linkDecoded.userId]);
                    if (linkUser) {
                        // Проверяем, не привязан ли уже этот VK ID к другому пользователю
                        const oauthTaken = await index_1.db.one("SELECT id FROM users WHERE oauthProvider = 'vk' AND oauthId = ? AND id != ?", [vkUserId, linkDecoded.userId]);
                        if (oauthTaken) {
                            // VK уже привязан к другому — логинимся в него
                            logger_1.default.warn({ vkUserId, linkUserId: linkDecoded.userId, takenBy: oauthTaken.id }, '[VK Bridge] VK already linked to another user');
                            await index_1.db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, oauthTaken.id]);
                            const takenUser = await index_1.db.one('SELECT username FROM users WHERE id = ?', [oauthTaken.id]);
                            const token = jsonwebtoken_1.default.sign({ userId: oauthTaken.id, role: 'player', username: takenUser.username, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
                            (0, audit_1.auditLoginSuccess)(takenUser.username, oauthTaken.id);
                            return res.json({ token, user: { id: oauthTaken.id, username: takenUser.username, role: 'player' } });
                        }
                        // Привязываем VK к существующему аккаунту
                        await index_1.db.run("UPDATE users SET oauthProvider = 'vk', oauthId = ?, lastLoginAt = ?, isGuest = 0 WHERE id = ?", [vkUserId, now, linkDecoded.userId]);
                        logger_1.default.info({ vkUserId, linkUserId: linkDecoded.userId, username: linkUser.username }, '[VK Bridge] VK linked to existing account');
                        const token = jsonwebtoken_1.default.sign({ userId: linkUser.id, role: 'player', username: linkUser.username, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
                        (0, audit_1.auditLoginSuccess)(linkUser.username, linkUser.id);
                        return res.json({ token, user: { id: linkUser.id, username: linkUser.username, role: 'player' } });
                    }
                }
            }
            catch (err) {
                logger_1.default.warn({ linkTokenErr: err.message }, '[VK Bridge] Invalid linkToken, falling back to normal flow');
            }
        }
        // Ищем существующего пользователя
        const existing = await index_1.db.one("SELECT id, username, level FROM users WHERE oauthProvider = 'vk' AND oauthId = ?", [vkUserId]);
        if (existing) {
            await index_1.db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, existing.id]);
            const token = jsonwebtoken_1.default.sign({ userId: existing.id, role: 'player', username: existing.username, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
            (0, audit_1.auditLoginSuccess)(existing.username, existing.id);
            return res.json({
                token,
                user: { id: existing.id, username: existing.username, role: 'player' },
            });
        }
        // Создаём нового пользователя
        let username = `vk_${vkUserId}`;
        let avatar = '';
        let gender = 'male';
        // Получаем данные из VK Bridge (клиент уже запросил VKWebAppGetUserInfo)
        if (vkUserInfo) {
            if (vkUserInfo.first_name || vkUserInfo.last_name) {
                username = `${vkUserInfo.first_name || ''}_${vkUserInfo.last_name || ''}`
                    .replace(/\s+/g, '_')
                    .substring(0, 20) || `vk_${vkUserId}`;
            }
            avatar = vkUserInfo.photo_200 || '';
            if (vkUserInfo.sex === 1)
                gender = 'female';
            else if (vkUserInfo.sex === 2)
                gender = 'male';
        }
        // Уникальность
        let finalUsername = username;
        let suffix = 1;
        while (await index_1.db.one('SELECT id FROM users WHERE username = ?', [finalUsername])) {
            finalUsername = `${username.substring(0, 17)}_${suffix}`;
            suffix++;
        }
        const randomHash = crypto_1.default.randomBytes(32).toString('hex');
        const startHp = (0, stats_1.currentStats)({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
        const premiumUntil = now + 86400;
        const equipment1 = (0, helpers_1.getStarterEquipment)();
        const eqObj = JSON.parse(equipment1);
        const insertResult = await index_1.db.raw(`INSERT INTO users (username, passwordhash, email, emailverified, oauthprovider, oauthid,
        currenthp, lasthpupdate, level, gender, avatar, lastloginat, premiumuntil, money, equipment_1)
       VALUES ($1, $2, $3, 1, 'vk', $4, $5, $6, 1, $7, $8, $9, $10, $11, $12) RETURNING id`, [finalUsername, randomHash, `vk_${vkUserId}@oauth.local`, vkUserId, startHp, now, gender, avatar, now, premiumUntil, 1000, eqObj]);
        const newUserId = Number(insertResult.rows[0].id);
        const token = jsonwebtoken_1.default.sign({ userId: newUserId, role: 'player', username: finalUsername, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
        (0, audit_1.auditLoginSuccess)(finalUsername, newUserId);
        return res.json({
            token,
            user: { id: newUserId, username: finalUsername, role: 'player' },
        });
    }
    catch (err) {
        logger_1.default.error(`[VK Bridge Auth] Error: ${err.message}`);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});
exports.default = router;
//# sourceMappingURL=vkBridgeAuth.js.map