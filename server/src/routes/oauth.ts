import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../database';
import { JWT_SECRET } from '../env';
import logger from '../logger';

const router = Router();

const YA_CLIENT_ID = process.env.YA_CLIENT_ID || '';
const YA_CLIENT_SECRET = process.env.YA_CLIENT_SECRET || '';
const VK_CLIENT_ID = process.env.VK_CLIENT_ID || '';
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || '';

const REDIRECT_URI_YA = 'https://mmoarena.ru/api/oauth/yandex/callback';
const REDIRECT_URI_VK = 'https://mmoarena.ru/api/oauth/vk/callback';
const FRONTEND_URL = 'https://mmoarena.ru';

// Хранилище code_verifier для PKCE (в памяти)
const pkceStore = new Map<string, { verifier: string; expires: number }>();

// Очистка просроченных записей раз в 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of pkceStore) {
        if (val.expires < now) pkceStore.delete(key);
    }
}, 5 * 60 * 1000);

function makeToken(userId: number, role: string): string {
    return jwt.sign({ userId, role, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '30d' });
}

function findOrCreateUser(provider: string, oauthId: string, username: string): { id: number; username: string; level: number } {
    const existing: any = db.prepare('SELECT id, username, level FROM users WHERE oauthProvider = ? AND oauthId = ?')
        .get(provider, oauthId);
    if (existing) return existing;

    let finalUsername = username.replace(/\s+/g, '_').substring(0, 20);
    let suffix = 1;
    while (db.prepare('SELECT id FROM users WHERE username = ?').get(finalUsername)) {
        finalUsername = `${finalUsername.substring(0, 17)}_${suffix}`;
        suffix++;
    }

    const now = Math.floor(Date.now() / 1000);
    const startHp = 20;
    const randomHash = crypto.randomBytes(32).toString('hex');
    const info = db.prepare(`INSERT INTO users (username, passwordHash, email, emailVerified, oauthProvider, oauthId, currentHp, lastHpUpdate, level, gender)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, 1, 'male')`)
        .run(finalUsername, randomHash, `${provider}_${oauthId}@oauth.local`, provider, oauthId, startHp, now);
    return { id: Number(info.lastInsertRowid), username: finalUsername, level: 1 };
}

// --- Яндекс ID ---
router.get('/yandex', (_req, res) => {
    const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YA_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_YA)}`;
    res.redirect(url);
});

router.get('/yandex/callback', async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }

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
        const tokenData: any = await tokenRes.json();
        if (!tokenRes.ok) {
            logger.error({ tokenData }, 'Yandex token exchange failed');
            return res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
        }

        const userRes = await fetch('https://login.yandex.ru/info?format=json', {
            headers: { Authorization: `OAuth ${tokenData.access_token}` },
        });
        const userData: any = await userRes.json();
        if (!userRes.ok || !userData.id) {
            logger.error({ userData }, 'Yandex user info failed');
            return res.redirect(`${FRONTEND_URL}/login?error=userinfo_failed`);
        }

        const user = findOrCreateUser('yandex', String(userData.id), userData.login || `yandex_${userData.id}`);
        const jwtToken = makeToken(user.id, 'player');
        logger.info({ provider: 'yandex', userId: user.id }, 'OAuth login');
        res.redirect(`${FRONTEND_URL}/?jwt=${jwtToken}`);
    } catch (err) {
        logger.error({ err }, 'Yandex OAuth error');
        res.redirect(`${FRONTEND_URL}/login?error=unknown`);
    }
});

// --- VK ID ---
router.get('/vk', (_req, res) => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    pkceStore.set(state, { verifier, expires: Date.now() + 10 * 60 * 1000 });

    const url = `https://id.vk.com/authorize?response_type=code&client_id=${VK_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_VK)}&scope=email&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
    res.redirect(url);
});

router.get('/vk/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }

    const pkce = state && typeof state === 'string' ? pkceStore.get(state) : undefined;
    if (pkce) pkceStore.delete(state as string);

    try {
        const bodyParams: Record<string, string> = {
            grant_type: 'authorization_code',
            code,
            client_id: VK_CLIENT_ID,
            client_secret: VK_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI_VK,
        };
        if (pkce) {
            bodyParams.code_verifier = pkce.verifier;
        }

        const tokenRes = await fetch('https://id.vk.com/oauth2/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(bodyParams),
        });
        const tokenData: any = await tokenRes.json();
        if (!tokenRes.ok) {
            logger.error({ tokenData, pkce: !!pkce }, 'VK token exchange failed');
            return res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
        }

        const userRes = await fetch('https://id.vk.com/oauth2/user_info', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData: any = await userRes.json();
        if (!userRes.ok || !userData.user?.user_id) {
            logger.error({ userData }, 'VK user info failed');
            return res.redirect(`${FRONTEND_URL}/login?error=userinfo_failed`);
        }

        const vkUser = userData.user;
        const displayName = `${vkUser.first_name || ''} ${vkUser.last_name || ''}`.trim() || `vk_${vkUser.user_id}`;
        const user = findOrCreateUser('vkontakte', String(vkUser.user_id), displayName);
        const jwtToken = makeToken(user.id, 'player');
        logger.info({ provider: 'vkontakte', userId: user.id }, 'OAuth login');
        res.redirect(`${FRONTEND_URL}/?jwt=${jwtToken}`);
    } catch (err) {
        logger.error({ err }, 'VK OAuth error');
        res.redirect(`${FRONTEND_URL}/login?error=unknown`);
    }
});

export default router;
