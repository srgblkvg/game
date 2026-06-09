import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import logger from './logger';

export function setupMiddleware(app: Express) {
  // Доверяем nginx прокси для корректной работы rate-limit и IP
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  // Rate limiting (можно отключить переменной DISABLE_RATE_LIMIT=true в .env)
  if (!process.env.DISABLE_RATE_LIMIT) {
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { error: 'Слишком много попыток, попробуйте позже' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/login', authLimiter);
    app.use('/api/register', authLimiter);
    app.use('/api/guest', authLimiter);
    app.use('/api/admin/register', authLimiter);

    const battleLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Слишком много боёв, подождите' }, standardHeaders: true, legacyHeaders: false });
    const chatLimiter = rateLimit({ windowMs: 60_000, max: 60, message: { error: 'Слишком много сообщений, подождите' }, standardHeaders: true, legacyHeaders: false });
    const craftLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Слишком много крафтов, подождите' }, standardHeaders: true, legacyHeaders: false });
    const playerLimiter = rateLimit({ windowMs: 60_000, max: 200, message: { error: 'Слишком много запросов, подождите' }, standardHeaders: true, legacyHeaders: false });

    app.use('/api/battle', battleLimiter);
    app.use('/api/arena', battleLimiter);
    app.use('/api/chat', chatLimiter);
    app.use('/api/craft', craftLimiter);
    app.use('/api', playerLimiter);
  }

  // Централизованная обработка ошибок
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ошибка валидации', details: err.issues });
    }
    if (err && typeof err.status === 'number' && err.status >= 400) {
      return res.status(err.status).json({ error: err.message || 'Ошибка запроса' });
    }
    logger.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });
}
