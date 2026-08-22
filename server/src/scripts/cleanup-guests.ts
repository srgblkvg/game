import { db } from '../db/index';

/**
 * Удаляет гостевые аккаунты старше 48 часов.
 * Активных участников турниров не трогает.
 */
async function cleanupGuests() {
  const cutoff = Math.floor(Date.now() / 1000) - 48 * 3600;
  const candidates = await db.query(
    'SELECT id FROM users WHERE isguest = 1 AND lastaction < $1 ORDER BY id',
    [cutoff],
  ) as Array<{ id: number }>;
  let deleted = 0;

  for (const candidate of candidates) {
    const userId = Number(candidate.id);
    const removed = await db.tx(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [932001, userId]);
      const user = (await client.query(
        'SELECT id FROM users WHERE id = $1 AND isguest = 1 AND lastaction < $2 FOR UPDATE',
        [userId, cutoff],
      )).rows[0];
      if (!user) return false;
      const activeTournament = (await client.query(
        `SELECT 1 FROM tournament_participants tp
         JOIN tournaments t ON t.id = tp.tournamentid
         WHERE tp.userid = $1 AND t.status IN ('registration', 'in_progress') LIMIT 1`,
        [userId],
      )).rows[0];
      if (activeTournament) return false;

      await client.query('DELETE FROM login_logs WHERE userid = $1', [userId]);
      await client.query(
        `DELETE FROM tournament_participants tp USING tournaments t
         WHERE tp.tournamentid = t.id AND tp.userid = $1 AND t.status <> 'completed'`,
        [userId],
      );
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      return true;
    });
    if (removed) deleted += 1;
  }

  console.log(`Гостей-кандидатов: ${candidates.length}. Удалено: ${deleted}.`);
  process.exit(0);
}

cleanupGuests().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
