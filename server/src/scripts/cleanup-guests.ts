import { db } from '../db/index';

/**
 * Удаляет ВСЕ гостевые аккаунты (isGuest = 1).
 * Чтобы твинки не фармили казино и не засоряли БД.
 */
async function cleanupGuests() {
  const countRow = await db.one(
    'SELECT COUNT(*) as cnt FROM users WHERE isGuest = 1'
  ) as any;

  const count = countRow?.cnt || 0;
  console.log(`Гостевых аккаунтов всего: ${count}`);

  if (count === 0) {
    console.log('Нечего удалять.');
    process.exit(0);
  }

  // Удаляем логи входа
  await db.run(
    `DELETE FROM login_logs WHERE userId IN (
      SELECT id FROM users WHERE isGuest = 1
    )`
  );

  // Удаляем гостей
  const result = await db.run('DELETE FROM users WHERE isGuest = 1');

  console.log(`Удалено: ${result.changes} гостевых аккаунтов.`);
  process.exit(0);
}

cleanupGuests().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
