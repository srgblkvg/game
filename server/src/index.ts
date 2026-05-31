import dotenv from 'dotenv';
dotenv.config(); // загружаем .env, если вдруг env.ts ещё не загружен (на всякий случай)

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import logger from './logger';

import { authMiddleware, requireAdmin, requirePlayer } from './middleware/auth';
import { setupWebSocket } from './websocket';
import { PORT } from './env';

import authRoutes from './routes/auth';
import adminAuthRoutes from './routes/adminAuth';
import characterRoutes from './routes/character';
import battleRoutes, { adminRouter as adminBattleRoutes } from './routes/battle';
import arenaRoutes from './routes/arena';
import shopRoutes from './routes/shop';
import jobsRoutes from './routes/jobs';
import adminRoutes from './routes/admin';
import adminJobsRoutes from './routes/adminJobs';
import adminChatRoutes from './routes/adminChat';
import accountRoutes from './routes/account';
import chatRoutes from './routes/chat';
import adminCraftRoutes from './routes/adminCraft';
import craftRoutes from './routes/craft';

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json());

// Rate limiting на логин и регистрацию (можно отключить переменной DISABLE_RATE_LIMIT=true в .env)
if (!process.env.DISABLE_RATE_LIMIT) {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 20, // максимум 20 попыток с одного IP
    message: { error: 'Слишком много попыток, попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/login', authLimiter);
  app.use('/api/register', authLimiter);
  app.use('/api/admin/register', authLimiter);
}

// Публичные маршруты
app.use('/api', authRoutes);
app.use('/api', adminAuthRoutes);

// Админские маршруты (до requirePlayer)
app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);
app.use('/api/admin', authMiddleware, requireAdmin, adminCraftRoutes);
app.use('/api/admin', authMiddleware, requireAdmin, adminJobsRoutes);
app.use('/api/admin/chat', authMiddleware, requireAdmin, adminChatRoutes);
app.use('/api/admin', authMiddleware, requireAdmin, adminBattleRoutes);


// Игровые маршруты (только для игроков)
app.use('/api', authMiddleware, requirePlayer);
app.use('/api', characterRoutes);
app.use('/api', battleRoutes);
app.use('/api', arenaRoutes);
app.use('/api', shopRoutes);
app.use('/api', jobsRoutes);
app.use('/api', accountRoutes);
app.use('/api', chatRoutes);
app.use('/api', authMiddleware, requirePlayer, craftRoutes);

// Централизованная обработка ошибок валидации
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'Ошибка валидации', details: err.issues });
  }
  logger.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => logger.info(`Server started on port ${PORT}`));