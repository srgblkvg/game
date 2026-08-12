"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCleanupScheduler = startCleanupScheduler;
// Очистка старых данных (>7 дней)
const cleanup_1 = require("../cleanup");
function startCleanupScheduler() {
    // Первый запуск через 60 секунд после старта
    setTimeout(() => { (0, cleanup_1.cleanupOldData)().catch(() => { }); }, 60000);
    // Далее раз в 24 часа
    setInterval(() => { (0, cleanup_1.cleanupOldData)().catch(() => { }); }, 24 * 3600 * 1000);
}
//# sourceMappingURL=cleanup.js.map