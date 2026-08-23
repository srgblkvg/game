import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import http from 'http';
import { setupMiddleware } from './setupMiddleware';
import { setupRoutes } from './setupRoutes';
import { setupWebSocket } from './websocket';
import { PORT } from './env';
import logger from './logger';
import { vkPaymentsReady } from './routes/vkPayments';
import { yooKassaPaymentsReady } from './routes/yukassa';
import { startSalaryScheduler } from './schedulers/salary';
import { startTournamentScheduler } from './schedulers/tournaments';
import { startCleanupScheduler } from './schedulers/cleanup';
import { startMassacreScheduler } from './schedulers/massacre';
import { startInactiveLeaderCheck } from './schedulers/inactiveLeader';
import { startJobCompletionScheduler } from './schedulers/jobs';
import { startGuildBossWeeklyResetScheduler } from './schedulers/guildBossWeeklyReset';
import { startAuctionSettlementScheduler } from './schedulers/auctionSettlement';
import { initTreasury, initTreasuryLog } from './game/treasury';
import { initExchange } from './game/exchange';
import { initTournamentSchema } from './game/tournamentSchema';
import { initBotAccounts } from './bots/botManager';

const app = express();

// Статические файлы (аватары)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

setupMiddleware(app);
setupRoutes(app);

const server = http.createServer(app);
const botAccountsReady = initBotAccounts();
const treasuryReady = botAccountsReady.then(() => Promise.all([initTreasury(), initTreasuryLog()]));

async function startServer() {
  await Promise.all([vkPaymentsReady, yooKassaPaymentsReady]);
  await botAccountsReady;
  await treasuryReady;
  await initExchange();
  await setupWebSocket(server);
  server.listen(PORT, () => logger.info(`Server started on port ${PORT}`));
}
startServer().catch(error => {
  logger.error('Server startup failed:', error?.message || error);
  process.exit(1);
});

// Турниры зависят от казны: первый тик запускаем только после инициализации.
Promise.allSettled([treasuryReady, initTournamentSchema()]).then((results) => {
  const labels = ['Treasury', 'Tournament schema'];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error(`${labels[index]} init failed:`, result.reason?.message || result.reason);
    }
  });
  const tournamentSchemaReady = results.every(result => result.status === 'fulfilled');
  if (tournamentSchemaReady) startTournamentScheduler();
  else logger.error('Tournament scheduler disabled: schema initialization failed');
});

startSalaryScheduler();
startCleanupScheduler();
startMassacreScheduler();
startInactiveLeaderCheck();
startJobCompletionScheduler();
startAuctionSettlementScheduler();
startGuildBossWeeklyResetScheduler().catch(e => logger.error('Guild boss weekly reset init failed:', e.message));
