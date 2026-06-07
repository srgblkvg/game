import { Express } from 'express';
import { authMiddleware, requireAdmin, requirePlayer, requireFullAccess } from './middleware/auth';
import { guestCooldown } from './middleware/guestCooldown';
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
import tournamentRoutes from './routes/tournament';
import adminTournamentRoutes from './routes/adminTournament';
import ordersRoutes from './routes/orders';
import logRoutes from './routes/log';
import questsRoutes from './routes/quests';

export function setupRoutes(app: Express) {
  // Публичные маршруты
  app.use('/api', authRoutes);
  app.use('/api', adminAuthRoutes);
  app.use('/api/oauth', oauthRoutes);

  // Приём клиентских ошибок (можно без авторизации — логируем всё)
  app.use('/api/log', logRoutes);

  // Админские маршруты
  app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminCraftRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminJobsRoutes);
  app.use('/api/admin/chat', authMiddleware, requireAdmin, adminChatRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminBattleRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminTournamentRoutes);

  // Игровые маршруты (только для игроков) + замедление гостей
  app.use('/api', authMiddleware, requirePlayer, guestCooldown);
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
  app.use('/api', craftRoutes);
  app.use('/api', mobsRoutes);
  app.use('/api', bankRoutes);
  app.use('/api', tavernRoutes);
  app.use('/api', auctionRoutes);
  app.use('/api', ordersRoutes);
  app.use('/api', questsRoutes);

  // Серверное время
  app.get('/api/time', (_req: any, res) => {
    res.json({ now: Math.floor(Date.now() / 1000) });
  });

  // Маршруты с полным доступом (гости заблокированы)
  app.use('/api', authMiddleware, requirePlayer, requireFullAccess, guestCooldown);
  app.use('/api', tournamentRoutes);
}
