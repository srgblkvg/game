// Авто-передача лидерства если лидер неактивен >3 дней
import { db } from '../db/index';
import logger from '../logger';

export async function checkInactiveLeaders(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 3 * 86400; // 3 дня

  const inactiveLeaders = await db.query(`
    SELECT gm.guildId, gm.userId, g.name as guildName, u.username
    FROM guild_members gm
    JOIN users u ON gm.userId = u.id
    JOIN guilds g ON gm.guildId = g.id
    WHERE gm.rank = 'leader' AND (u.lastLoginAt IS NULL OR u.lastLoginAt < ?)
  `, [cutoff]) as any[];

  for (const leader of inactiveLeaders) {
    // Ищем преемника: офицер с max lastLoginAt, если нет — участник с max lastLoginAt
    let successor = await db.one(`
      SELECT gm.userId FROM guild_members gm
      JOIN users u ON gm.userId = u.id
      WHERE gm.guildId = ? AND gm.rank = 'officer' AND gm.userId != ?
      ORDER BY u.lastLoginAt DESC NULLS LAST LIMIT 1
    `, [leader.guildId, leader.userId]) as any;

    if (!successor) {
      successor = await db.one(`
        SELECT gm.userId FROM guild_members gm
        JOIN users u ON gm.userId = u.id
        WHERE gm.guildId = ? AND gm.userId != ?
        ORDER BY u.lastLoginAt DESC NULLS LAST LIMIT 1
      `, [leader.guildId, leader.userId]) as any;
    }

    if (successor) {
      await db.run('UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?',
        ['leader', leader.guildId, successor.userId]);
      await db.run('UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?',
        ['officer', leader.guildId, leader.userId]);
      logger.info(`[InactiveLeader] Guild ${leader.guildName}: leadership transferred from ${leader.username}(${leader.userId}) to ${successor.userId} (inactive ${Math.floor((now - (leader.lastLoginAt || 0)) / 86400)}d)`);
    }
  }
}

export function startInactiveLeaderCheck(): void {
  // Первый запуск через 5 минут после старта
  setTimeout(() => { checkInactiveLeaders().catch(e => logger.error('[InactiveLeader] Error:', e)); }, 300000);
  // Далее раз в час
  setInterval(() => { checkInactiveLeaders().catch(e => logger.error('[InactiveLeader] Error:', e)); }, 3600 * 1000);
}
