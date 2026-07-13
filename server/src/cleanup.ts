// Ежедневная очистка старых данных (держать не более 7 дней)
import { db } from './db/index';

export async function cleanupOldData() {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const weekAgoISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const dayAgoISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  
  const results: string[] = [];
  
  // Авто-отмена турниров, зависших в in_progress дольше суток
  const stuckCnt = await db.run(
    `UPDATE tournaments SET status = 'cancelled' WHERE status = 'in_progress' AND createdat < ?`,
    [dayAgoISO]
  );
  if (stuckCnt.changes > 0) {
    results.push(`stuck_tournaments_cancelled: ${stuckCnt.changes}`);
  }
  
  // Турнирные матчи (по completedAt турнира + cancelled)
  const tm = await db.run(
    `DELETE FROM tournament_matches WHERE tournamentId IN (SELECT id FROM tournaments WHERE status IN ('completed', 'cancelled') AND completedat IS NOT NULL AND completedat < ?)`,
    [weekAgo]
  );
  results.push(`tournament_matches: ${tm.changes}`);
  
  // Турниры завершённые
  const tp = await db.run(`DELETE FROM tournament_participants WHERE tournamentId IN (SELECT id FROM tournaments WHERE status = 'completed' AND completedAt < ?)`, [weekAgo]);
  results.push(`tournament_participants: ${tp.changes}`);
  
  const tt = await db.run(`DELETE FROM tournaments WHERE status = 'completed' AND completedAt < ?`, [weekAgo]);
  results.push(`tournaments: ${tt.changes}`);
  
  // Сообщения чата
  const cm = await db.run(`DELETE FROM chat_messages WHERE createdAt < ?`, [weekAgoISO]);
  results.push(`chat_messages: ${cm.changes}`);
  
  // Бои PvP
  const bl = await db.run(`DELETE FROM battles WHERE createdAt < ?`, [weekAgo]);
  results.push(`battles: ${bl.changes}`);
  
  // Бои PvE
  const pve = await db.run(`DELETE FROM pve_battles WHERE createdAt < ?`, [weekAgo]);
  results.push(`pve_battles: ${pve.changes}`);
  
  // Аукцион
  const ah = await db.run(`DELETE FROM auction_history WHERE createdAt < ?`, [weekAgo]);
  results.push(`auction_history: ${ah.changes}`);
  
  // Квесты
  const qh = await db.run(`DELETE FROM quest_history WHERE createdAt < ?`, [weekAgo]);
  results.push(`quest_history: ${qh.changes}`);
  
  // История работ
  const jh = await db.run(`DELETE FROM job_history WHERE endTime < ?`, [weekAgo]);
  results.push(`job_history: ${jh.changes}`);
  
  // Старые приглашения в гильдию (pending старше 14 дней)
  const gi = await db.run(`DELETE FROM guild_invites WHERE status = 'pending' AND createdat < ?`, [weekAgoISO]);
  results.push(`guild_invites: ${gi.changes}`);

  console.log(`[cleanup] ${new Date().toISOString()}: ${results.join(', ')}`);
}
