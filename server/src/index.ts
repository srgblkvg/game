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
