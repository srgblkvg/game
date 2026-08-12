// Создание и авто-продвижение турниров (раз в 5 минут)
import { db } from '../db/index';

export function startTournamentScheduler(): void {
  setInterval(async () => {
    try {
      const mod = await import('../routes/tournament');
      await mod.getOrCreateTournament();
      const all = await db.query(
        "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ORDER BY id DESC", []
      ) as any[];
      for (const t of all) await mod.autoAdvance(t.id);
    } catch {}
  }, 5 * 60 * 1000);
}
