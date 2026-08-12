"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGuestRestrictionsDisabled = isGuestRestrictionsDisabled;
exports.setGuestRestrictionsDisabled = setGuestRestrictionsDisabled;
exports.toggleGuestRestrictions = toggleGuestRestrictions;
exports.authMiddleware = authMiddleware;
exports.requireAdmin = requireAdmin;
exports.requirePlayer = requirePlayer;
exports.requireFullAccess = requireFullAccess;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../env");
const tokenBlacklist_1 = require("../tokenBlacklist");
const index_1 = require("../db/index");
// Временное отключение гостевых ограничений (тестирование)
let guestRestrictionsDisabled = false;
async function isGuestRestrictionsDisabled() { return guestRestrictionsDisabled; }
async function setGuestRestrictionsDisabled(v) { guestRestrictionsDisabled = v; }
async function toggleGuestRestrictions() { guestRestrictionsDisabled = !guestRestrictionsDisabled; return guestRestrictionsDisabled; }
// Кеш для троттлинга обновления lastLoginAt (раз в 5 мин)
const lastLoginUpdates = new Map();
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Не авторизован' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
        if (decoded.jti && (0, tokenBlacklist_1.isTokenRevoked)(decoded.jti)) {
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
                await index_1.db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [now, decoded.userId]);
            }
            // lastAction для /users/online — без троттлинга
            index_1.db.run('UPDATE users SET lastAction = ? WHERE id = ?', [now, decoded.userId]).catch(() => { });
        }
        next();
    }
    catch {
        res.status(401).json({ error: 'Токен недействителен' });
    }
}
async function requireAdmin(req, res, next) {
    if (req.role !== 'admin')
        return res.status(403).json({ error: 'Доступ запрещён' });
    next();
}
async function requirePlayer(req, res, next) {
    if (req.role === 'admin')
        return res.status(403).json({ error: 'Администратор не может выполнять игровые действия' });
    next();
}
async function requireFullAccess(req, res, next) {
    if (guestRestrictionsDisabled)
        return next();
    if (req.isGuest)
        return res.status(403).json({ error: 'На гостевом аккаунте доступ к этой функции заблокирован' });
    next();
}
//# sourceMappingURL=auth.js.map