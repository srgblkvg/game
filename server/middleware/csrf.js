"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfMiddleware = csrfMiddleware;
const crypto_1 = __importDefault(require("crypto"));
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
function csrfMiddleware(req, res, next) {
    // Для безопасных методов — просто выдаём/обновляем токен
    if (CSRF_SAFE_METHODS.includes(req.method)) {
        if (!req.cookies?.[CSRF_COOKIE]) {
            const token = crypto_1.default.randomBytes(32).toString('hex');
            res.cookie(CSRF_COOKIE, token, {
                httpOnly: false, // JS должен читать
                sameSite: 'strict',
                secure: false, // dev без HTTPS
                maxAge: 24 * 60 * 60 * 1000,
            });
        }
        return next();
    }
    // Для мутирующих методов — проверяем
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'CSRF-токен недействителен' });
    }
    next();
}
//# sourceMappingURL=csrf.js.map