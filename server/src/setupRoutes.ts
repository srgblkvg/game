import { Express } from 'express';
import { authMiddleware, requireAdmin, requirePlayer } from './middleware/auth';
import authRoutes from './routes/auth';
import adminAuthRoutes from './routes/adminAuth';
import adminRoutes from './routes/admin';
import adminCraftRoutes from './routes/adminCraft';
import adminJobsRoutes from './routes/adminJobs';
import adminChatRoutes from './routes/adminChat';
import battleRoutes, { adminRouter as adminBattleRoutes } from './routes/battle';
import characterRoutes from './routes/character';
import inventoryRoutes from './routes/inventory';
import usersRoutes from './routes/users';
import ratingRoutes from './routes/rating';
import characterStatsRoutes from './routes/characterStats';
import arenaRoutes from './routes/arena';
import shopRoutes from './routes/shop';
import jobsRoutes from './routes/jobs';
import accountRoutes from './routes/account';
import chatRoutes from './routes/chat';
import craftRoutes from './routes/craft';
import oauthRoutes from './routes/oauth';
import mobsRoutes from './routes/mobs';
import bankRoutes from './routes/bank';
import tavernRoutes from './routes/tavern';
import auctionRoutes from './routes/auction';

export function setupRoutes(app: Express) {
  // Публичные маршруты
  app.use('/api', authRoutes);
  app.use('/api', adminAuthRoutes);
  app.use('/api/oauth', oauthRoutes);

  // Админские маршруты
  app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminCraftRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminJobsRoutes);
  app.use('/api/admin/chat', authMiddleware, requireAdmin, adminChatRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminBattleRoutes);

  // Игровые маршруты (только для игроков)
  app.use('/api', authMiddleware, requirePlayer);
  app.use('/api', characterRoutes);
  app.use('/api', inventoryRoutes);
  app.use('/api', usersRoutes);
  app.use('/api', ratingRoutes);
  app.use('/api', characterStatsRoutes);
  app.use('/api', battleRoutes);
  app.use('/api', arenaRoutes);
  app.use('/api', shopRoutes);
  app.use('/api', jobsRoutes);
  app.use('/api', accountRoutes);
  app.use('/api', chatRoutes);
  app.use('/api', authMiddleware, requirePlayer, craftRoutes);
  app.use('/api', authMiddleware, requirePlayer, mobsRoutes);
  app.use('/api', authMiddleware, requirePlayer, bankRoutes);
  app.use('/api', authMiddleware, requirePlayer, tavernRoutes);
  app.use('/api', authMiddleware, requirePlayer, auctionRoutes);
}
