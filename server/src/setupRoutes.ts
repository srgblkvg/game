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
import logRoutes from './routes/log';
import questsRoutes from './routes/quests';
import guildRoutes from './routes/guild';
import feedbackRoutes, { adminFeedbackRouter } from './routes/feedback';
import adminGameRoutes from './routes/adminGame';
import actionsRoutes from './routes/actions';
import collectionsRoutes from './routes/collections';
import adminCollectionsRoutes from './routes/adminCollections';
import adminBotsRoutes from './routes/adminBots';
import guildBuildingsRoutes from './routes/guildBuildings';
import guildBossRoutes from './routes/guildBoss';
import battleSimRoutes from './routes/battleSim';
import overflowRoutes from './routes/overflow';
import vkPaymentsRoutes from './routes/vkPayments';
import vkBridgeAuthRoutes from './routes/vkBridgeAuth';
import yukassaRoutes from './routes/yukassa';
import treasuryRoutes from './routes/treasury';
import exchangeRoutes from './routes/exchange';
import forumRoutes from './routes/forum';
import massacreRoutes from './routes/massacre';
import casinoRoutes from './routes/casino';
import diceRoutes from './routes/dice';
import trainingRoutes from './routes/training';
import donateRoutes from './routes/donate';
import tutorialRoutes from './routes/tutorial';
import achievementsRoutes from './routes/achievements';
import debugRoutes from './routes/debug';
import factionRoutes from './routes/faction';
import dungeonRoutes from './routes/dungeon';

export function setupRoutes(app: Express) {
  // Публичные маршруты
  app.use('/api', authRoutes);
  app.use('/api', adminAuthRoutes);
  app.use('/api/oauth', oauthRoutes);

  // Действия (публичный)
  app.use('/api', actionsRoutes);

  // Казна замка (публичный)
  app.use('/api', treasuryRoutes);
  app.use('/api', exchangeRoutes);

  // Форум — последние темы (публичный, для замка)
  app.get('/api/forum/latest', async (_req: any, res) => {
    const { db } = await import('./db/index');
    const threads = await db.query(`
      SELECT t.*, u.username as author_name,
             lp.username as last_poster_name
      FROM forum_threads t
      JOIN users u ON t.author_id = u.id
      LEFT JOIN users lp ON (SELECT author_id FROM forum_posts WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) = lp.id
      ORDER BY t.updated_at DESC LIMIT 3
    `, []) as any[];
    res.json(threads);
  });

  // Этажи (публичный — нужен бестиарию)
  app.get('/api/floors', async (_req: any, res) => {
    const rows = await db.query('SELECT * FROM floors ORDER BY sort_order, name') as any[];
    const DIFF_MAP: Record<string,number> = {
        'Склеп':0,'Подземелье':0,'Катакомбы':0,'Деревня Пепла':0,
        'Лес Черепов':1,'Старый Тракт':1,'Ядовитые луга':1,'Первый ярус':1,
        'Гнилая Топь':2,'Чёрный Монастырь':2,'Башня Плакальщиц':2,'Некрополь Королей':2,
        'Бездонный Овраг':3,'Врата Бездны':3,
        'Огненные чертоги':4,'Тронный зал':4,
        'Ледяная бездна':5,'Престол падших':5,
        'Кровавый предел':6,'Трон Проклятых':6,
    };
    const DIFF_LABELS = ['Легко','Нормально','Сложно','Ад I','Ад II','Ад III','Ад IV'];
    const DIFF_ICONS = ['🟢','🟡','🟠','🔴','🔴','🔴','🔴'];
    const floors = rows.map(r => ({...r, difficulty: DIFF_MAP[r.name] ?? 0}));
    const groups = DIFF_LABELS.map((label,i) => ({label, icon: DIFF_ICONS[i], difficulty: i}));
    res.json({ floors, groups });
  });

  // Серверное время (публичный)
  app.get('/api/time', (_req: any, res) => {
    res.json({ now: Math.floor(Date.now() / 1000) });
  });

  // Приём клиентских ошибок (можно без авторизации — логируем всё)
  app.use('/api/log', logRoutes);

  // VK Payments — публичный колбэк (без middleware, подпись проверяется внутри)
  app.use('/api/vk/payments', vkPaymentsRoutes);

  // YooKassa webhook — публичный (без middleware)
  app.use('/api/yukassa', yukassaRoutes);

  // Админские маршруты
  app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);

  // VK Bridge Auth (публичный, проверка токена внутри)
  app.use('/api/auth', vkBridgeAuthRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminCraftRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminJobsRoutes);
  app.use('/api/admin/chat', authMiddleware, requireAdmin, adminChatRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminBattleRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminTournamentRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminGameRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminFeedbackRouter);
  app.use('/api/admin', authMiddleware, requireAdmin, adminCollectionsRoutes);
  app.use('/api/admin', authMiddleware, requireAdmin, adminBotsRoutes);

  // Тоггл гостевых ограничений
  app.post('/api/admin/toggle-guest', authMiddleware, requireAdmin, (req, res) => {
    const disabled = toggleGuestRestrictions();
    res.json({ guestRestrictionsDisabled: disabled });
  });

  // Гербы гильдий — публичный доступ (кешируются браузером)
  app.get('/api/guild/:id/image', async (req, res) => {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) return res.status(404).end();
    const { db } = await import('./db/index');
    const row = await db.one('SELECT image FROM guilds WHERE id = ?', [guildId]) as any;
    if (!row?.image) return res.status(404).end();
    const img: string = row.image;
    const mime = img.startsWith('data:image/') 
        ? img.slice(5, img.indexOf(';')) 
        : 'image/jpeg';
    const data = img.includes(',') 
        ? Buffer.from(img.split(',')[1] || '', 'base64')
        : Buffer.from(img, 'base64');
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(data);
  });

  // Игровые маршруты (только для игроков) + замедление гостей
  app.use('/api', authMiddleware, requirePlayer, guestCooldown);
  app.use('/api', battleSimRoutes);  // симулятор боёв
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
  app.use('/api', questsRoutes);
  // Гильд-босс напрямую (до guildRoutes с /guild/:id)
  app.get('/api/guild/boss/ping', (_req, res) => { res.json({ ok: true }); });
  app.use('/api', guildBossRoutes);
  app.use('/api', guildRoutes);
  app.use('/api', guildBuildingsRoutes);
  app.use('/api', feedbackRoutes);
  app.use('/api', tournamentRoutes);
  app.use('/api', collectionsRoutes);
  app.use('/api/overflow', overflowRoutes);
  app.use('/api', forumRoutes);
  app.use('/api', massacreRoutes);
  app.use('/api', casinoRoutes);
  app.use('/api', diceRoutes);
  app.use('/api', trainingRoutes);
  app.use('/api', tutorialRoutes);
  app.use('/api', achievementsRoutes);
  app.use('/api', debugRoutes);
  app.use('/api', factionRoutes);
  app.use('/api', dungeonRoutes);
  app.use('/api/donate', donateRoutes);

  // Маршруты с полным доступом (гости заблокированы)
  app.use('/api', authMiddleware, requirePlayer, requireFullAccess, guestCooldown);
}
