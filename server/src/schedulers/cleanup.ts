// Очистка старых данных (>7 дней)
import { cleanupOldData } from '../cleanup';

export function startCleanupScheduler(): void {
  // Первый запуск через 60 секунд после старта
  setTimeout(() => { cleanupOldData().catch(() => {}); }, 60000);
  // Далее раз в 24 часа
  setInterval(() => { cleanupOldData().catch(() => {}); }, 24 * 3600 * 1000);
}
