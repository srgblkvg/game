// Авто-завершение работ
import { db } from '../db/index';
import { completeJob, jobIdentity } from '../game/jobCompletion';
import { createPgJobCompletionRepository } from '../game/jobCompletionRepository';
import { runJobCompletionEffects } from '../game/jobCompletionEffects';
export function startJobCompletionScheduler(): void {
 setInterval(async () => {
  try {
   const now = Math.floor(Date.now()/1000);
   const users = await db.query('SELECT id, activejob FROM users WHERE activejob IS NOT NULL AND id > 0', []) as any[];
   for (const user of users) {
    let job: any; try { job = JSON.parse(user.activeJob || user.activejob); } catch { continue; }
    if (!job || now < job.endTime) continue;
    const result = await completeJob(createPgJobCompletionRepository(), { userId: user.id, now, mode: 'expired', expectedJobIdentity: jobIdentity(job) });
    if (result.completed) await runJobCompletionEffects(result);
   }
  } catch (e: any) { console.error('Job completion scheduler error:', e.message); }
 }, 30000);
}
