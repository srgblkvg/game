import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../env';

export function authMiddleware(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.adminId = decoded.adminId;
        req.role = decoded.role;
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