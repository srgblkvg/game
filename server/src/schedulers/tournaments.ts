// Создание и авто-продвижение турниров (раз в 5 минут)
import { db } from '../db/index';

export function startTournamentScheduler(): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const mod = await import('../routes/tournament');
      await mod.reconcileOfficialQueueParticipants();
      await mod.rebalanceOfficialQueuePools();
      await mod.mergeExpiredOfficialQueues();
      await mod.rebalanceOfficialQueuePools();
      const all = await db.query(
        "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ORDER BY id DESC", []
      ) as any[];
      for (const t of all) await mod.autoAdvance(t.id);
      await mod.getOrCreateTournament();
    } catch {} finally {
      running = false;
    }
  };

  void tick();
  setInterval(tick, 5 * 60 * 1000);
}
