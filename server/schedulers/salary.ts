// Жалование: 10 серебра минимум +1 за каждую PvE-победу (в 00 минут)
// Стражники: бонус от кармы ±100% (karma=-100→0%, karma=0→100%, karma=100→200%)
import { db } from '../db/index';
import logger from '../logger';

let lastSalaryHour = -1;

export function startSalaryScheduler(): void {
  setInterval(async () => {
    const now = new Date();
    if (now.getMinutes() !== 0 || now.getHours() === lastSalaryHour) return;
    lastSalaryHour = now.getHours();
    try {
      const users = await db.query(
        'SELECT id, username, pvewins, faction, karma FROM users WHERE id > 0'
      ) as any[];
      if (users.length === 0) return;

      const nowISO = new Date().toISOString();
      let paidCount = 0;

      for (const u of users) {
        let baseAmount = 10 + (u.pveWins || 0);
        // Бонус кармы для Стражников: ±100% линейно
        if (u.faction === 'guard') {
          const karma = u.karma || 0;
          const mult = 1 + karma / 100; // -100→0, 0→1, 100→2
          baseAmount = Math.max(0, Math.round(baseAmount * mult));
        }
        if (baseAmount <= 0) continue;

        await db.run('UPDATE users SET money = money + ? WHERE id = ?', [baseAmount, u.id]);
        await db.run(
          "INSERT INTO chat_messages (senderId, targetId, content, createdAt) VALUES (0, ?, ?, ?)",
          [u.id, `💰 Жалование: +${baseAmount} серебра`, nowISO]
        );
        paidCount++;
      }

      if (paidCount > 0) {
        logger.info(`Salary: paid ${paidCount} players`);
      }
    } catch (e: any) {
      logger.error('PvE salary error:', e?.message || e);
    }
  }, 30000);
}
