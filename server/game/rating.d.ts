/**
 * Расчёт нового ELO по формуле:
 *   Новый = Старый + K × (Результат − Ожидание)
 *   Ожидание = 1 / (1 + 10^((R_оппонента − R_игрока) / 400))
 */
export declare function calcElo(playerElo: number, opponentElo: number, playerWon: boolean, level: number): number;
/**
 * Декай рейтинга за неактивность в PvP
 */
export declare function applyDecay(userId: number, lastPvpTime: number, elo: number): Promise<number>;
/**
 * Начисление PvE-рейтинга
 * Возвращает { eloAdded, newElo }
 */
export declare function addPveRating(userId: number, amount: number, pveRating: number, elo: number, cooldownCheck: (user: any) => boolean): Promise<{
    eloAdded: number;
    newElo: number;
} | null>;
/**
 * Проверка и сброс сезона при необходимости
 */
export declare function checkSeasonReset(): Promise<boolean>;
//# sourceMappingURL=rating.d.ts.map