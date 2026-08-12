import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Для безопасных методов — просто выдаём/обновляем токен
  if (CSRF_SAFE_METHODS.includes(req.method)) {
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,   // JS должен читать
        sameSite: 'strict',
        secure: false,     // dev без HTTPS
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
    return next();
  }

  // Для мутирующих методов — проверяем
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF-токен недействителен' });
  }

  next();
}
