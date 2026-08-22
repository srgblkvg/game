import type { CompletedJobResult } from './jobCompletion';
import { markDirty, pushNotification } from '../events';
export async function runJobCompletionEffects(r: CompletedJobResult): Promise<void> {
 const tasks: Promise<unknown>[] = [];
 if (r.levelsGained > 0) tasks.push(import('../routes/achievements').then(m => m.setAchievementProgress(r.userId, 'level', r.level)));
 if (r.levelsGained > 0 && r.oauthProvider === 'vk' && r.oauthId) tasks.push(import('../vkLeaderboard').then(m => m.sendLeaderboardLevel(r.userId, r.level, String(r.oauthId))));
 if (r.guildId !== null) {
  tasks.push(import('../routes/guild/guildQuests').then(m => m.updateGuildQuestProgress(r.guildId!, 'jobs', r.job.duration)));
  if (r.tax > 0) tasks.push(import('../routes/guild/guildQuests').then(m => m.updateGuildQuestProgress(r.guildId!, 'donate', r.tax)));
 }
 pushNotification(r.userId, { type: 'system', message: `Работа «${r.job.name}» завершена! +${r.rewardAfterTax} серебра, +${r.xpGained} XP` });
 markDirty(r.userId, 'quests');
 await Promise.allSettled(tasks);
}
