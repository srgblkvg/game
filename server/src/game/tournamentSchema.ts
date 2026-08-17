import { db } from '../db/index';

let schemaPromise: Promise<void> | null = null;
let schemaReady = false;

const REQUIRED_COLUMNS = [
  'tournament_matches.group_name',
  'tournament_matches.series_index',
  'tournament_matches.stage',
  'users.tournament_division',
  'users.tournament_division_wins',
];

/**
 * Проверяет, что deployment-миграция применена. Приложение работает без DDL-прав
 * и не должно пытаться менять схему на старте или во время HTTP-запроса.
 */
export function initTournamentSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const rows = await db.raw(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'users' AND column_name IN ('tournament_division', 'tournament_division_wins'))
           OR
           (table_name = 'tournament_matches' AND column_name IN ('stage', 'group_name', 'series_index'))
         )`,
    );
    const found = new Set(rows.rows.map((row: any) => `${row.table_name}.${row.column_name}`));
    const missing = REQUIRED_COLUMNS.filter(column => !found.has(column));
    if (missing.length > 0) {
      throw new Error(`Не применена миграция турнирных дивизионов: ${missing.join(', ')}`);
    }
    const indexRows = await db.raw(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'tournament_participants'
         AND indexname = 'tournament_participants_tournament_user_uidx'`,
    );
    const indexDefinition = String(indexRows.rows[0]?.indexdef || '').toLowerCase();
    if (!indexDefinition.includes('unique')
      || !indexDefinition.includes('(tournamentid, userid)')) {
      throw new Error('Не применён UNIQUE индекс tournament_participants(tournamentid, userid)');
    }
    schemaReady = true;
  })();
  return schemaPromise;
}

export function isTournamentSchemaReady(): boolean {
  return schemaReady;
}
