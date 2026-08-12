// server/src/schedulers/massacre.ts — проверка окончания сбора и запуск боя
import { db } from '../db/index';
import { runMassacreBattle } from '../game/massacre';

export function startMassacreScheduler(): void {
    // Проверяем каждые 10 секунд
    setInterval(async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            const events = await db.query(
                `SELECT id FROM massacre_events WHERE status = 'gathering' AND gathering_end <= ?`,
                [now]
            ) as any[];

            for (const ev of events) {
                // Запускаем бой
                await db.run(`UPDATE massacre_events SET status = 'in_progress' WHERE id = ?`, [ev.id]);
                runMassacreBattle(ev.id).catch(err => console.error('[massacre] battle error:', err));
            }
        } catch (err) {
            console.error('[massacre scheduler] error:', err);
        }
    }, 10000);

    // Создать первое событие при старте если нет активного
    (async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            const active = await db.one(
                `SELECT COUNT(*) as cnt FROM massacre_events WHERE status = 'gathering'`,
                []
            ) as any;
            if (active.cnt === 0) {
                await db.run(
                    `INSERT INTO massacre_events (status, gathering_end) VALUES ('gathering', ?)`,
                    [now + 1800]
                );
                console.log('[massacre] создано новое событие резни');
            }
        } catch (err) {
            console.error('[massacre init] error:', err);
        }
    })();
}
