import { db } from '../db/index';

/**
 * Удаляет гостевые аккаунты старше 48 часов.
 * Гость = isGuest = 1. Не трогаем свежих — даём 2 суток на игру.
 */
async function cleanupGuests() {
  const cutoff = Math.floor(Date.now() / 1000) - 48 * 3600;

  const countRow = await db.one(
    'SELECT COUNT(*) as cnt FROM users WHERE isGuest = 1 AND lastaction < $1',
    [cutoff]
  ) as any;

  const count = countRow?.cnt || 0;
  console.log(`Гостей старше 48ч: ${count}`);

  if (count === 0) {
    console.log('Нечего удалять.');
    process.exit(0);
  }

  // Удаляем логи входа
  await db.run(
    `DELETE FROM login_logs WHERE userId IN (
      SELECT id FROM users WHERE isGuest = 1 AND lastaction < $1
    )`,
    [cutoff]
  );

  // Удаляем гостей
  const result = await db.run(
    'DELETE FROM users WHERE isGuest = 1 AND lastaction < $1',
    [cutoff]
  );

  console.log(`Удалено: ${result.changes} гостей.`);
  process.exit(0);
}

cleanupGuests().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
