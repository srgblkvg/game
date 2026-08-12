// Авто-завершение работ: проверяет активные работы и начисляет награду
import { db } from '../db/index';
import { pushNotification, markDirty } from '../events';

export function startJobCompletionScheduler(): void {
  setInterval(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      // Найти работы с истекшим сроком
      const completed = await db.query(
        `SELECT id, username, activejob, exp, level, statpoints, money, guildid, oauthprovider, oauthid
         FROM users WHERE activejob IS NOT NULL AND id > 0`,
        []
      ) as any[];

      for (const user of completed) {
        let jobData: any;
        try { jobData = JSON.parse(user.activejob); } catch { continue; }
        if (!jobData || now < jobData.endTime) continue;

        // Применить опыт
        const { applyExp, collectGuildTax } = await import('../db/helpers');
        const { updateGuildQuestProgress } = await import('../routes/guild/guildQuests');

        const taxedReward = await collectGuildTax(user.id, jobData.reward, 'tax_job');
        const { newExp, newLevel, levelsGained, newStatPoints } = applyExp(
          user.id, jobData.expReward || 0, user.exp, user.level, user.statpoints || 0
        );

        const finalMoney = user.money - jobData.reward + taxedReward;

        await db.run(
          'UPDATE users SET money = ?, exp = ?, level = ?, statpoints = ?, activejob = NULL, totaljobmoney = totaljobmoney + ?, totaljobseconds = totaljobseconds + ? WHERE id = ?',
          [finalMoney, newExp, newLevel, newStatPoints, jobData.reward, jobData.duration, user.id]
        );

        await db.run(
          'INSERT INTO job_history (userid, jobid, jobname, duration, reward, startedat, premiumbonus, xpgained) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [user.id, jobData.jobId, jobData.name, jobData.duration, jobData.reward,
           new Date(jobData.startTime * 1000).toISOString(), jobData.premiumBonus || 0, jobData.expReward || 0]
        );

        // VK Leaderboard
        if (levelsGained > 0 && user.oauthprovider === 'vk' && user.oauthid) {
          const { sendLeaderboardLevel } = await import('../vkLeaderboard');
          sendLeaderboardLevel(user.id, newLevel, String(user.oauthid)).catch(() => {});
        }

        // Guild quest
        if (user.guildid) {
          updateGuildQuestProgress(user.guildid, 'jobs', jobData.duration)
            .catch((e: Error) => console.error('guildQuest jobs:', e.message));
        }

        // Уведомление
        pushNotification(user.id, {
          type: 'system',
          message: `Работа «${jobData.name}» завершена! +${taxedReward} серебра, +${(jobData.expReward || 0)} XP`,
        });

        markDirty(user.id, 'quests');
      }
    } catch (e: any) {
      console.error('Job completion scheduler error:', e.message);
    }
  }, 30000); // каждые 30 секунд
}
