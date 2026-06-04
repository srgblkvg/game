import type Database from 'better-sqlite3';

/**
 * Расчёт нового ELO по формуле:
 *   Новый = Старый + K × (Результат − Ожидание)
 *   Ожидание = 1 / (1 + 10^((R_оппонента − R_игрока) / 400))
 */
export function calcElo(playerElo: number, opponentElo: number, playerWon: boolean, level: number): number {
    const k = level <= 10 ? 40 : level <= 25 ? 30 : level <= 50 ? 20 : 15;
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    const result = playerWon ? 1 : 0;
    return Math.max(100, Math.round(playerElo + k * (result - expected)));
}

/**
 * Декай рейтинга за неактивность в PvP
 */
export function applyDecay(db: InstanceType<typeof Database>, userId: number, lastPvpTime: number, elo: number): number {
    const now = Math.floor(Date.now() / 1000);
    if (!lastPvpTime) return elo;

    const daysSinceLastPvp = Math.floor((now - lastPvpTime) / 86400);
    if (daysSinceLastPvp < 7) return elo;

    let decayPerDay = 5;
    if (daysSinceLastPvp >= 30) decayPerDay = 20;
    else if (daysSinceLastPvp >= 14) decayPerDay = 10;

    const daysToDecay = daysSinceLastPvp - 6; // первые 6 дней без штрафа
    const decay = daysToDecay * decayPerDay;
    const newElo = Math.max(100, elo - decay);

    if (newElo !== elo) {
        db.prepare('UPDATE users SET elo = ?, lastEloDecay = ? WHERE id = ?').run(newElo, now, userId);
    }

    return newElo;
}

/**
 * Начисление PvE-рейтинга
 * Возвращает { eloAdded, newElo }
 */
export function addPveRating(
    db: InstanceType<typeof Database>,
    userId: number,
    amount: number,
    pveRating: number,
    elo: number,
    cooldownCheck: (user: any) => boolean,
): { eloAdded: number; newElo: number } | null {
    const user = db.prepare(
        'SELECT lastPveRatingTime, lastBossKillDate, pveRating, elo FROM users WHERE id = ?'
    ).get(userId) as any;
    if (!user) return null;

    if (!cooldownCheck(user)) return null;

    // PvE-потолок: не более 15% от общего ELO
    const pveCap = Math.floor(Math.max(1000, elo) * 0.15);
    if ((user.pveRating || 0) >= pveCap) return null;

    const actualAmount = Math.min(amount, pveCap - (user.pveRating || 0));
    if (actualAmount <= 0) return null;

    const newElo = Math.max(100, (elo || 1000) + actualAmount);
    const newPveRating = (user.pveRating || 0) + actualAmount;

    return { eloAdded: actualAmount, newElo };
}

/**
 * Проверка и сброс сезона при необходимости
 */
export function checkSeasonReset(db: InstanceType<typeof Database>): boolean {
    const season = db.prepare("SELECT * FROM seasons WHERE status = 'active' LIMIT 1").get() as any;
    if (!season) return false;

    const now = new Date();
    const endDate = new Date(season.endDate);
    if (now < endDate) return false;

    // Сезон закончился — архивируем топ-10
    const top10 = db.prepare(
        'SELECT id, username, elo FROM users ORDER BY elo DESC LIMIT 10'
    ).all() as any[];

    const insertHof = db.prepare(
        'INSERT INTO hall_of_fame (seasonId, userId, rank, elo, title) VALUES (?, ?, ?, ?, ?)'
    );

    for (let i = 0; i < top10.length; i++) {
        insertHof.run(season.id, top10[i].id, i + 1, top10[i].elo, null);
    }

    // Закрываем старый сезон
    db.prepare("UPDATE seasons SET status = 'finished' WHERE id = ?").run(season.id);

    // Создаём новый
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNext = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0, 23, 59, 59);
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const seasonName = `${monthNames[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`;

    db.prepare('INSERT INTO seasons (name, startDate, endDate) VALUES (?, ?, ?)').run(
        seasonName, nextMonth.toISOString(), endOfNext.toISOString()
    );

    // Мягкий сброс ELO: Новый = 1000 + (Старый − 1000) × 0.5
    const allUsers = db.prepare('SELECT id, elo FROM users').all() as any[];
    const resetStmt = db.prepare('UPDATE users SET elo = ?, seasonWins = 0, seasonLosses = 0, pveRating = 0 WHERE id = ?');
    for (const u of allUsers) {
        const oldElo = u.elo || 1000;
        const newElo = Math.round(1000 + (oldElo - 1000) * 0.5);
        resetStmt.run(newElo, u.id);
    }

    return true;
}
