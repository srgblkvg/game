"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMassacreScheduler = startMassacreScheduler;
// server/src/schedulers/massacre.ts — проверка окончания сбора и запуск боя
const index_1 = require("../db/index");
const massacre_1 = require("../game/massacre");
function startMassacreScheduler() {
    // Проверяем каждые 10 секунд
    setInterval(async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            const events = await index_1.db.query(`SELECT id FROM massacre_events WHERE status = 'gathering' AND gathering_end <= ?`, [now]);
            for (const ev of events) {
                // Запускаем бой
                await index_1.db.run(`UPDATE massacre_events SET status = 'in_progress' WHERE id = ?`, [ev.id]);
                (0, massacre_1.runMassacreBattle)(ev.id).catch(err => console.error('[massacre] battle error:', err));
            }
        }
        catch (err) {
            console.error('[massacre scheduler] error:', err);
        }
    }, 10000);
    // Создать первое событие при старте если нет активного
    (async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            const active = await index_1.db.one(`SELECT COUNT(*) as cnt FROM massacre_events WHERE status = 'gathering'`, []);
            if (active.cnt === 0) {
                await index_1.db.run(`INSERT INTO massacre_events (status, gathering_end) VALUES ('gathering', ?)`, [now + 1800]);
                console.log('[massacre] создано новое событие резни');
            }
        }
        catch (err) {
            console.error('[massacre init] error:', err);
        }
    })();
}
//# sourceMappingURL=massacre.js.map