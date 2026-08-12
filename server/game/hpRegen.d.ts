/**
 * Применяет офлайн-регенерацию HP для игрока.
 * Возвращает актуальное currentHp и обновляет БД если изменилось.
 *
 * Реген: 1 HP каждые 10 сек (базовый), ускорение от комнаты:
 *   closet=×3, bed=×10, chamber=×50
 */
export declare function applyHpRegen(user: {
    id: number;
    currentHp: number;
    maxHp: number;
    lastHpUpdate: number;
    roomType?: string | null;
    roomUntil?: number;
    premiumUntil?: number;
    hermitRegen?: boolean;
}): Promise<number>;
//# sourceMappingURL=hpRegen.d.ts.map