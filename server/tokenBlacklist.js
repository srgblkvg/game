"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeToken = revokeToken;
exports.isTokenRevoked = isTokenRevoked;
// In-memory blacklist для отозванных JWT
// Ключ: jti (JWT ID), значение: timestamp истечения
const blacklist = new Map();
// Очистка просроченных записей каждые 10 минут
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of blacklist) {
        if (exp < now)
            blacklist.delete(jti);
    }
}, 10 * 60 * 1000);
function revokeToken(jti, exp) {
    blacklist.set(jti, exp);
}
function isTokenRevoked(jti) {
    return blacklist.has(jti);
}
//# sourceMappingURL=tokenBlacklist.js.map