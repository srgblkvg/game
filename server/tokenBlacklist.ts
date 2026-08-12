// In-memory blacklist для отозванных JWT
// Ключ: jti (JWT ID), значение: timestamp истечения
const blacklist = new Map<string, number>();

// Очистка просроченных записей каждые 10 минут
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of blacklist) {
    if (exp < now) blacklist.delete(jti);
  }
}, 10 * 60 * 1000);

export function revokeToken(jti: string, exp: number) {
  blacklist.set(jti, exp);
}

export function isTokenRevoked(jti: string): boolean {
  return blacklist.has(jti);
}
