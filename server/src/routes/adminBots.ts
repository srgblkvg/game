import { Router } from 'express';
import { startBots, stopBots, getBotsStatus } from '../bots/botManager';

const router = Router();

// Статус ботов
router.get('/bots', (req, res) => {
  res.json(getBotsStatus());
});

// Запустить ботов
router.post('/bots/start', async (req, res) => {
  const { count = 3, useExisting = true } = req.body;
  try {
    const result = await startBots(count, useExisting);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Остановить ботов
router.post('/bots/stop', async (req, res) => {
  const result = await stopBots();
  res.json(result);
});

export default router;
