import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../env';
import { isTokenRevoked } from '../tokenBlacklist';

// Временное отключение гостевых ограничений (тестирование)
let guestRestrictionsDisabled = false;
export function isGuestRestrictionsDisabled() { return guestRestrictionsDisabled; }
export function setGuestRestrictionsDisabled(v: boolean) { guestRestrictionsDisabled = v; }
export function toggleGuestRestrictions(): boolean { guestRestrictionsDisabled = !guestRestrictionsDisabled; return guestRestrictionsDisabled; }

export function authMiddleware(req: any, res: any, next: any) {
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
        next();
    } catch {
        res.status(401).json({ error: 'Токен недействителен' });
    }
}

export function requireAdmin(req: any, res: any, next: any) {
    if (req.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
    next();
}

export function requirePlayer(req: any, res: any, next: any) {
    if (req.role === 'admin') return res.status(403).json({ error: 'Администратор не может выполнять игровые действия' });
    next();
}

export function requireFullAccess(req: any, res: any, next: any) {
    if (guestRestrictionsDisabled) return next();
    if (req.isGuest) return res.status(403).json({ error: 'На гостевом аккаунте доступ к этой функции заблокирован' });
    next();
}