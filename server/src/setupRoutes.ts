import { Express } from 'express';
import { authMiddleware, requireAdmin, requirePlayer, requireFullAccess, toggleGuestRestrictions } from './middleware/auth';
import { guestCooldown } from './middleware/guestCooldown';
import { db } from './db/index';
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
import guildRoutes from './routes/guild';
import feedbackRoutes, { adminFeedbackRouter } from './routes/feedback';
import adminGameRoutes from './routes/adminGame';
import actionsRoutes from './routes/actions';
import collectionsRoutes from './routes/collections';
import adminCollectionsRoutes from './routes/adminCollections';

export function setupRoutes(app: Express) {
  // Публичные маршруты
  app.use('/api', authRoutes);
  app.use('/api', adminAuthRoutes);
  app.use('/api/oauth', oauthRoutes);

  // Действия (публичный)
  app.use('/api', actionsRoutes);

  // Этажи (публичный — нужен бестиарию)
  app.get('/api/floors', async (_req: any, res) => {
    res.json(await db.query('SELECT * FROM floors ORDER BY sort_order, name'));
  });

  // Серверное время (публичный)
  app.get('/api/time', (_req: any, res) => {
    res.json({ now: Math.floor(Date.now() / 1000) });
  });

  // Приём клиентских ошибок (можно без авторизации — логируем всё)
  app.use('/api/log', logRoutes);

  // Админские маршруты
  app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminCraftRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminJobsRoutes);
  app.use('/api/admin/chat', authMiddleware, requireAdmin, adminChatRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminBattleRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminTournamentRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminGameRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminFeedbackRouter);
  app.use('/api/admin', authMiddleware, requireAdmin, adminCollectionsRoutes);

  // Тоггл гостевых ограничений
  app.post('/api/admin/toggle-guest', authMiddleware, requireAdmin, (req, res) => {
    const disabled = toggleGuestRestrictions();
    res.json({ guestRestrictionsDisabled: disabled });
  });

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
  app.use('/api', guildRoutes);
  app.use('/api', feedbackRoutes);
  app.use('/api', tournamentRoutes);
  app.use('/api', collectionsRoutes);

  // Маршруты с полным доступом (гости заблокированы)
  app.use('/api', authMiddleware, requirePlayer, requireFullAccess, guestCooldown);
}
