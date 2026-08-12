declare const router: import("express-serve-static-core").Router;
/**
 * Разрешить все незавершённые матчи текущего раунда.
 * Возвращает номер разрешённого раунда (или 0 если ничего не сделано).
 */
export declare function resolveCurrentRound(tournamentId: number): Promise<number>;
export declare function autoAdvance(tournamentId: number): Promise<void>;
export declare function getOrCreateTournament(type?: string): Promise<any[]>;
export default router;
//# sourceMappingURL=tournament.d.ts.map