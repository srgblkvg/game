// Авто-передача лидерства если лидер неактивен >3 дней
import { db } from '../db/index';
import logger from '../logger';
import { findGuildLeadershipSuccessorWithClient, lockGuildForLeadershipWithClient, transferGuildLeadershipWithClient } from '../game/guildLeadership';

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
    const successorId = await db.tx(async client => {
      await lockGuildForLeadershipWithClient(client, leader.guildId);
      const successorId = await findGuildLeadershipSuccessorWithClient(client, leader.guildId, leader.userId);
      if (successorId === null) return null;
      await transferGuildLeadershipWithClient(client, {
        guildId: leader.guildId,
        currentLeaderId: leader.userId,
        newLeaderId: successorId,
      });
      return successorId;
    });

    if (successorId !== null) {
      logger.info(`[InactiveLeader] Guild ${leader.guildName}: leadership transferred from ${leader.username}(${leader.userId}) to ${successorId} (inactive ${Math.floor((now - (leader.lastLoginAt || 0)) / 86400)}d)`);
    }
  }
}

export function startInactiveLeaderCheck(): void {
  // Первый запуск через 5 минут после старта
  setTimeout(() => { checkInactiveLeaders().catch(e => logger.error('[InactiveLeader] Error:', e)); }, 300000);
  // Далее раз в час
  setInterval(() => { checkInactiveLeaders().catch(e => logger.error('[InactiveLeader] Error:', e)); }, 3600 * 1000);
}
