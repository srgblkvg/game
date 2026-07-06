import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index';
import { JWT_SECRET } from '../env';
import logger from '../logger';
import { auditLoginSuccess } from '../audit';
import { currentStats } from '../game/stats';

const router = Router();

const VK_APP_SECRET = process.env.VK_APP_SECRET || '';
const VK_SERVICE_KEY = process.env.VK_SERVICE_KEY || process.env.VK_CLIENT_SECRET || VK_APP_SECRET;

// Проверка подписи параметров запуска VK
// Алгоритм: HMAC-SHA256(защищённый_ключ, query_string_без_sign) → URL-safe base64
function verifyLaunchParams(launchParams: string, sign: string): boolean {
  if (!VK_APP_SECRET) return false;
  try {
    // Убираем &sign=... из строки запроса
    const cleanQuery = launchParams
      .split('&')
      .filter(p => !p.startsWith('sign='))
      .join('&');
    const hmac = crypto.createHmac('sha256', VK_APP_SECRET).update(cleanQuery).digest();
    const computed = hmac.toString('base64url').replace(/=+$/, '');
    return computed === sign;
  } catch {
    return false;
  }
}

// POST /api/auth/vk-bridge — вход через параметры запуска VK
router.post('/vk-bridge', async (req: Request, res: Response) => {
  const { vkUserId, sign, launchParams, vkUserInfo } = req.body as {
    vkUserId?: string;
    sign?: string;
    launchParams?: string;
    vkUserInfo?: { first_name?: string; last_name?: string; photo_200?: string; sex?: number };
  };

  if (!vkUserId || !sign) {
    return res.status(400).json({ error: 'Нет параметров запуска VK' });
  }

  // Проверяем подпись параметров запуска
  if (!verifyLaunchParams(launchParams || '', sign)) {
    logger.warn(`[VK Bridge Auth] Invalid launch signature for user ${vkUserId}`);
    return res.status(401).json({ error: 'Недействительная подпись запуска' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    // Ищем существующего пользователя
    const existing: any = await db.one(
      "SELECT id, username, level FROM users WHERE oauthProvider = 'vk' AND oauthId = ?",
      [vkUserId],
    );

    if (existing) {
      // Проверяем что персонаж не удалён (есть level и hp)
      const char = await db.one('SELECT level, currentHp FROM users WHERE id = ?', [existing.id]);
      if (!char || char.level < 1 || char.currentHp < 1) {
        // Персонаж удалён — сбрасываем до начального состояния
        const startHp = currentStats({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
        await db.run(
          'UPDATE users SET level = 1, currentHp = ?, lastHpUpdate = ?, s=5, a=5, d=5, m=5, statPoints=0, exp=0, elo=1000 WHERE id = ?',
          [startHp, now, existing.id],
        );
        logger.info(`[VK Bridge Auth] Reset stale user ${existing.id} for VK ${vkUserId}`);
      }
      await db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, existing.id]);

      const token = jwt.sign(
        { userId: existing.id, role: 'player', username: existing.username, jti: crypto.randomUUID() },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      auditLoginSuccess(existing.username, existing.id);

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
      if (vkUserInfo.sex === 1) gender = 'female';
      else if (vkUserInfo.sex === 2) gender = 'male';
    }

    // Уникальность
    let finalUsername = username;
    let suffix = 1;
    while (await db.one('SELECT id FROM users WHERE username = ?', [finalUsername])) {
      finalUsername = `${username.substring(0, 17)}_${suffix}`;
      suffix++;
    }

    const randomHash = crypto.randomBytes(32).toString('hex');
    const startHp = currentStats({ s: 5, a: 5, d: 5, m: 5 }, {}).hp;
    const premiumUntil = now + 86400;

    const info = await db.run(
      `INSERT INTO users (username, passwordHash, email, emailVerified, oauthProvider, oauthId,
        currentHp, lastHpUpdate, level, gender, avatar, lastLoginAt, premiumUntil)
       VALUES (?, ?, ?, 1, 'vk', ?, ?, ?, 1, ?, ?, ?, ?)`,
      [finalUsername, randomHash, `vk_${vkUserId}@oauth.local`, vkUserId, startHp, now, gender, avatar, now, premiumUntil],
    );

    const newUserId = Number(info.lastInsertRowid);

    const token = jwt.sign(
      { userId: newUserId, role: 'player', username: finalUsername, jti: crypto.randomUUID() },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    auditLoginSuccess(finalUsername, newUserId);

    return res.json({
      token,
      user: { id: newUserId, username: finalUsername, role: 'player' },
    });
  } catch (err: any) {
    logger.error(`[VK Bridge Auth] Error: ${err.message}`);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
