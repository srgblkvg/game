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

const app = express();

// Статические файлы (аватары)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

setupMiddleware(app);
setupRoutes(app);

const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => logger.info(`Server started on port ${PORT}`));

// ── Schedulers ──
import { startSalaryScheduler } from './schedulers/salary';
import { startTournamentScheduler } from './schedulers/tournaments';
import { startCleanupScheduler } from './schedulers/cleanup';
import { startMassacreScheduler } from './schedulers/massacre';
import { startInactiveLeaderCheck } from './schedulers/inactiveLeader';
import { startJobCompletionScheduler } from './schedulers/jobs';
import { initTreasury, initTreasuryLog } from './game/treasury';
import { initExchange } from './game/exchange';

// Init tables
initTreasury().catch(e => logger.error('Treasury init failed:', e.message));
initTreasuryLog().catch(e => logger.error('Treasury log init failed:', e.message));
initExchange().catch(e => logger.error('Exchange init failed:', e.message));

startSalaryScheduler();
startTournamentScheduler();
startCleanupScheduler();
startMassacreScheduler();
startInactiveLeaderCheck();
startJobCompletionScheduler();
