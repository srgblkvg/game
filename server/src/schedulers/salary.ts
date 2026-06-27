// Жалование: 10 серебра минимум +1 за каждую PvE-победу (в 00 минут)
import { db } from '../db/index';
import logger from '../logger';

let lastSalaryHour = -1;

export function startSalaryScheduler(): void {
  setInterval(async () => {
    const now = new Date();
    if (now.getMinutes() !== 0 || now.getHours() === lastSalaryHour) return;
    lastSalaryHour = now.getHours();
    try {
      const result = await db.run(
        'UPDATE users SET money = money + 10 + pvewins WHERE id > 0'
      );
      if (result.changes > 0) {
        logger.info(`Salary: 10+pveWins to bank for ${result.changes} players`);
        const paid = await db.query(
          'SELECT id, username, pvewins FROM users WHERE id > 0'
        ) as any[];
        const nowISO = new Date().toISOString();
        for (const u of paid) {
          const amount = 10 + (u.pveWins || 0);
          await db.run(
            "INSERT INTO chat_messages (senderId, targetId, content, createdAt) VALUES (0, ?, ?, ?)",
            [u.id, `💰 Жалование: +${amount} серебра`, nowISO]
          );
        }
      }
    } catch (e: any) {
      logger.error('PvE salary error:', e?.message || e);
    }
  }, 30000);
}
