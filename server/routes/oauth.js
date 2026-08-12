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
const YA_CLIENT_ID = process.env.YA_CLIENT_ID || '';
const YA_CLIENT_SECRET = process.env.YA_CLIENT_SECRET || '';
const VK_CLIENT_ID = process.env.VK_CLIENT_ID || '';
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || '';
const REDIRECT_URI_YA = 'https://mmoarena.ru/api/oauth/yandex/callback';
const REDIRECT_URI_VK = 'https://mmoarena.ru/api/oauth/vk/callback';
const FRONTEND_URL = 'https://mmoarena.ru';
// Хранилище code_verifier для PKCE (в памяти)
// Формат: { verifier, expires, linkUserId? }
const pkceStore = new Map();
// Очистка просроченных записей раз в 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of pkceStore) {
        if (val.expires < now)
            pkceStore.delete(key);
    }
}, 5 * 60 * 1000);
async function makeToken(userId, role) {
    return jsonwebtoken_1.default.sign({ userId, role, jti: crypto_1.default.randomUUID() }, env_1.JWT_SECRET, { expiresIn: '7d' });
}
async function findOrCreateUser(provider, oauthId, username, linkUserId) {
    const now = Math.floor(Date.now() / 1000);
    // Если передан linkUserId — привязываем OAuth к существующему аккаунту
    if (linkUserId) {
        const linkUser = await index_1.db.one('SELECT id, username, level FROM users WHERE id = ?', [linkUserId]);
        if (linkUser) {
            // Проверяем, не привязан ли уже этот VK ID к другому пользователю
            const oauthTaken = await index_1.db.one('SELECT id FROM users WHERE oauthProvider = ? AND oauthId = ? AND id != ?', [provider, oauthId, linkUserId]);
            if (oauthTaken) {
                logger_1.default.warn({ provider, oauthId, linkUserId, takenBy: oauthTaken.id }, 'OAuth link: VK ID already linked to another user');
                // Входим в аккаунт, к которому уже привязан VK
                await index_1.db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, oauthTaken.id]);
                return { id: oauthTaken.id, username: oauthTaken.username, level: oauthTaken.level };
            }
            await index_1.db.run('UPDATE users SET oauthProvider = ?, oauthId = ?, lastLoginAt = ?, isGuest = 0 WHERE id = ?', [provider, oauthId, now, linkUserId]);
            logger_1.default.info({ provider, oauthId, linkUserId, username: linkUser.username }, 'OAuth linked to existing account');
            return { id: linkUser.id, username: linkUser.username, level: linkUser.level };
        }
        // linkUserId не найден — падаем в обычную логику создания
        logger_1.default.warn({ linkUserId }, 'OAuth link: userId not found, falling back to find-or-create');
    }
    const existing = await index_1.db.one('SELECT id, username, level FROM users WHERE oauthProvider = ? AND oauthId = ?', [provider, oauthId]);
    if (existing) {
        // Обновляем имя если было id... или vk_...
        if (existing.username.startsWith('vk_') || existing.username.startsWith('id')) {
            let newName = username;
            let suffix = 1;
            while (newName !== existing.username && await index_1.db.one('SELECT id FROM users WHERE username = ?', [newName])) {
                newName = `${username.substring(0, 17)}_${suffix}`;
                suffix++;
            }
            await index_1.db.run('UPDATE users SET username = ?, lastLoginAt = ? WHERE id = ?', [newName, now, existing.id]);
            return { id: existing.id, username: newName, level: existing.level };
        }
        // Обновляем время последнего входа
        await index_1.db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, existing.id]);
        return existing;
    }
    let finalUsername = username.replace(/\s+/g, '_').substring(0, 20);
    let suffix = 1;
    while (await index_1.db.one('SELECT id FROM users WHERE username = ?', [finalUsername])) {
        finalUsername = `${finalUsername.substring(0, 17)}_${suffix}`;
        suffix++;
    }
    const startHp = (0, stats_1.currentStats)({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
    const randomHash = crypto_1.default.randomBytes(32).toString('hex');
    const premiumUntil = now + 86400; // 1 день премиума за привязку
    const equipment1 = (0, helpers_1.getStarterEquipment)();
    const eqObj = JSON.parse(equipment1);
    const insertResult = await index_1.db.raw(`INSERT INTO users (username, passwordhash, email, emailverified, oauthprovider, oauthid, currenthp, lasthpupdate, level, gender, lastloginat, premiumuntil, money, equipment_1)
        VALUES ($1, $2, $3, 1, $4, $5, $6, $7, 1, 'male', $8, $9, $10, $11) RETURNING id`, [finalUsername, randomHash, `${provider}_${oauthId}@oauth.local`, provider, oauthId, startHp, now, now, premiumUntil, 1000, eqObj]);
    return { id: Number(insertResult.rows[0].id), username: finalUsername, level: 1 };
}
// --- Яндекс ID ---
router.get('/yandex', async (req, res) => {
    // Проверяем, хочет ли пользователь привязать Яндекс к существующему аккаунту
    let linkUserId;
    const linkToken = req.query.link_token;
    if (linkToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(linkToken, env_1.JWT_SECRET);
            if (decoded.userId) {
                linkUserId = decoded.userId;
                logger_1.default.info({ linkUserId }, 'Yandex OAuth: linking to existing user');
            }
        }
        catch { /* токен невалидный — просто игнорируем */ }
    }
    const state = crypto_1.default.randomBytes(16).toString('hex');
    pkceStore.set(state, { verifier: '', expires: Date.now() + 10 * 60 * 1000, ...(linkUserId !== undefined ? { linkUserId } : {}) });
    const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YA_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_YA)}&state=${state}`;
    res.redirect(url);
});
router.get('/yandex/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }
    const pkce = state && typeof state === 'string' ? pkceStore.get(state) : undefined;
    if (pkce)
        pkceStore.delete(state);
    try {
        const tokenRes = await fetch('https://oauth.yandex.ru/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: YA_CLIENT_ID,
                client_secret: YA_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI_YA,
            }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            logger_1.default.error({ tokenData }, 'Yandex token exchange failed');
            return res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
        }
        const userRes = await fetch('https://login.yandex.ru/info?format=json', {
            headers: { Authorization: `OAuth ${tokenData.access_token}` },
        });
        const userData = await userRes.json();
        if (!userRes.ok || !userData.id) {
            logger_1.default.error({ userData }, 'Yandex user info failed');
            return res.redirect(`${FRONTEND_URL}/login?error=userinfo_failed`);
        }
        const user = await findOrCreateUser('yandex', String(userData.id), userData.login || `yandex_${userData.id}`, pkce?.linkUserId);
        const jwtToken = await makeToken(user.id, 'player');
        // Логируем IP и аудит
        if (req.ip) {
            await index_1.db.run('INSERT INTO login_logs (userId, ip) VALUES (?, ?)', [user.id, req.ip]);
        }
        (0, audit_1.auditLoginSuccess)(user.username, user.id, req.ip);
        logger_1.default.info({ provider: 'yandex', userId: user.id }, 'OAuth login');
        res.redirect(`${FRONTEND_URL}/?jwt=${jwtToken}`);
    }
    catch (err) {
        logger_1.default.error({ err }, 'Yandex OAuth error');
        res.redirect(`${FRONTEND_URL}/login?error=unknown`);
    }
});
// --- VK ID ---
router.get('/vk', async (req, res) => {
    const verifier = crypto_1.default.randomBytes(32).toString('base64url');
    const challenge = crypto_1.default.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto_1.default.randomBytes(16).toString('hex');
    // Проверяем, хочет ли пользователь привязать VK к существующему аккаунту
    let linkUserId;
    const linkToken = req.query.link_token;
    if (linkToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(linkToken, env_1.JWT_SECRET);
            if (decoded.userId) {
                linkUserId = decoded.userId;
                logger_1.default.info({ linkUserId }, 'VK OAuth: linking to existing user');
            }
        }
        catch { /* токен невалидный — просто игнорируем */ }
    }
    pkceStore.set(state, { verifier, expires: Date.now() + 10 * 60 * 1000, ...(linkUserId !== undefined ? { linkUserId } : {}) });
    const url = `https://id.vk.com/authorize?response_type=code&client_id=${VK_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_VK)}&scope=email&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
    res.redirect(url);
});
router.get('/vk/callback', async (req, res) => {
    const { code, state, device_id } = req.query;
    if (!code || typeof code !== 'string') {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }
    const pkce = state && typeof state === 'string' ? pkceStore.get(state) : undefined;
    if (pkce)
        pkceStore.delete(state);
    try {
        const bodyParams = {
            grant_type: 'authorization_code',
            code,
            client_id: VK_CLIENT_ID,
            client_secret: VK_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI_VK,
        };
        if (pkce) {
            bodyParams.code_verifier = pkce.verifier;
        }
        if (device_id && typeof device_id === 'string') {
            bodyParams.device_id = device_id;
        }
        const tokenRes = await fetch('https://id.vk.com/oauth2/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(bodyParams),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            logger_1.default.error({ tokenData, pkce: !!pkce }, 'VK token exchange failed');
            return res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
        }
        // Ищем user_id во всех возможных местах
        let vkUserId = '';
        let displayName = '';
        // 1. Из id_token (JWT)
        if (tokenData.id_token) {
            try {
                const rawPayload = tokenData.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                const idPayload = JSON.parse(Buffer.from(rawPayload, 'base64').toString());
                vkUserId = String(idPayload.sub || idPayload.user_id || '');
                displayName = [idPayload.first_name, idPayload.last_name].filter(Boolean).join(' ');
            }
            catch { }
        }
        // 2. Из поля user_id ответа
        if (!vkUserId)
            vkUserId = String(tokenData.user_id || '');
        // 3. Если всё ещё нет — ошибка
        if (!vkUserId) {
            logger_1.default.error({ tokenKeys: Object.keys(tokenData) }, 'VK: no user_id found');
            return res.redirect(`${FRONTEND_URL}/login?error=userinfo_failed`);
        }
        // 4. Имя через API VK
        if (!displayName && tokenData.access_token) {
            try {
                const apiRes = await fetch(`https://api.vk.com/method/users.get?user_ids=${vkUserId}&v=5.199&access_token=${tokenData.access_token}`);
                const apiData = await apiRes.json();
                if (apiData.response?.[0]) {
                    const u = apiData.response[0];
                    displayName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                }
            }
            catch { }
        }
        if (!displayName)
            displayName = `id${vkUserId}`;
        const user = await findOrCreateUser('vk', vkUserId, displayName, pkce?.linkUserId);
        const jwtToken = await makeToken(user.id, 'player');
        // Логируем IP и аудит
        if (req.ip) {
            await index_1.db.run('INSERT INTO login_logs (userId, ip) VALUES (?, ?)', [user.id, req.ip]);
        }
        (0, audit_1.auditLoginSuccess)(user.username, user.id, req.ip);
        logger_1.default.info({ provider: 'vkontakte', userId: user.id }, 'OAuth login');
        res.redirect(`${FRONTEND_URL}/?jwt=${jwtToken}`);
    }
    catch (err) {
        logger_1.default.error({ err }, 'VK OAuth error');
        res.redirect(`${FRONTEND_URL}/login?error=unknown`);
    }
});
exports.default = router;
//# sourceMappingURL=oauth.js.map