import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../env';
import { isTokenRevoked } from '../tokenBlacklist';
import { db } from '../db/index';

// Временное отключение гостевых ограничений (тестирование)
let guestRestrictionsDisabled = false;
export async function isGuestRestrictionsDisabled() { return guestRestrictionsDisabled; }
export async function setGuestRestrictionsDisabled(v: boolean) { guestRestrictionsDisabled = v; }
export async function toggleGuestRestrictions(): Promise<boolean> { guestRestrictionsDisabled = !guestRestrictionsDisabled; return guestRestrictionsDisabled; }

// Кеш для троттлинга обновления lastLoginAt (раз в 5 мин)
const lastLoginUpdates = new Map<string, number>();

export async function authMiddleware(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded.jti && isTokenRevoked(decoded.jti)) {
          return res.status(401).json({ error: 'Токен отозван' });
        }
        req.userId = decoded.userId;
        req.adminId = decoded.adminId;
        req.role = decoded.role;
        req.isGuest = decoded.isGuest || false;

        // Обновляем lastLoginAt раз в 5 минут (только для игроков)
        if (decoded.role === 'player') {
            const now = Math.floor(Date.now() / 1000);
            const key = `llu_${decoded.userId}`;
            const last = lastLoginUpdates.get(key) || 0;
            if (now - last > 300) {
                lastLoginUpdates.set(key, now);
                await db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, decoded.userId]);
            }
        }

        next();
    } catch {
        res.status(401).json({ error: 'Токен недействителен' });
    }
}

export async function requireAdmin(req: any, res: any, next: any) {
    if (req.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
    next();
}

export async function requirePlayer(req: any, res: any, next: any) {
    if (req.role === 'admin') return res.status(403).json({ error: 'Администратор не может выполнять игровые действия' });
    next();
}

export async function requireFullAccess(req: any, res: any, next: any) {
    if (guestRestrictionsDisabled) return next();
    if (req.isGuest) return res.status(403).json({ error: 'На гостевом аккаунте доступ к этой функции заблокирован' });
    next();
}
