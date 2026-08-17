import { db } from '../db/index';

let schemaPromise: Promise<void> | null = null;

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
  })();
  return schemaPromise;
}
