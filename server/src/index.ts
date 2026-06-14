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

// ── Жалование за PvE: +1 серебра в час за каждый PvE-бой (в 00 минут) ──
import { db } from './db/index';
let lastSalaryHour = -1;
setInterval(async () => {
  const now = new Date();
  if (now.getMinutes() !== 0 || now.getHours() === lastSalaryHour) return;
  lastSalaryHour = now.getHours();
  try {
    const result = await db.run(
      'UPDATE users SET money = money + pvewins WHERE pvewins > 0 AND id > 0'
    );
    if (result.changes > 0) {
      logger.info(`Salary: +1×pveWins to bank for ${result.changes} players`);
      const paid = await db.query(
        'SELECT id, username, pvewins FROM users WHERE pvewins > 0 AND id > 0'
      ) as any[];
      const nowISO = new Date().toISOString();
      for (const u of paid) {
        await db.run(
          "INSERT INTO chat_messages (senderId, targetId, content, createdAt) VALUES (0, ?, ?, ?)",
          [u.id, `💰 Жалование: +${u.pvewins} серебра`, nowISO]
        );
      }
    }
  } catch (e: any) {
    logger.error('PvE salary error:', e?.message || e);
  }
}, 30000);
