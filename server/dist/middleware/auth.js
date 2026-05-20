"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireAdmin = requireAdmin;
exports.requirePlayer = requirePlayer;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../env");
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Не авторизован' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
        req.userId = decoded.userId;
        req.adminId = decoded.adminId;
        req.role = decoded.role;
        next();
    }
    catch {
        res.status(401).json({ error: 'Токен недействителен' });
    }
}
function requireAdmin(req, res, next) {
    if (req.role !== 'admin')
        return res.status(403).json({ error: 'Доступ запрещён' });
    next();
}
function requirePlayer(req, res, next) {
    if (req.role === 'admin')
        return res.status(403).json({ error: 'Администратор не может выполнять игровые действия' });
    next();
}
//# sourceMappingURL=auth.js.map