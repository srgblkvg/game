import { db } from '../db/index';

export interface HpRegenBonuses {
    roomType?: string | null;
    roomUntil?: number;
    premiumUntil?: number;
    hermitRegen?: boolean;
}

/** HP restored per base 5-second tick after all multiplicative bonuses. */
export function calculateHpRegenRate(user: HpRegenBonuses, now = Math.floor(Date.now() / 1000)): number {
    let regenRate = 1;
    if (user.roomType && (user.roomUntil || 0) > now) {
        if (user.roomType === 'closet') regenRate = 3;
        else if (user.roomType === 'bed') regenRate = 10;
        else if (user.roomType === 'chamber') regenRate = 50;
        else if (user.roomType === 'lux') regenRate = 250;
    }
    if ((user.premiumUntil || 0) > now) regenRate *= 3;
    if (user.hermitRegen) regenRate *= 2;
    return regenRate;
}

/**
 * Применяет офлайн-регенерацию HP для игрока.
 * Возвращает актуальное currentHp и обновляет БД если изменилось.
 *
 * Реген: 1 HP каждые 10 сек (базовый), ускорение от комнаты:
 *   closet=×3, bed=×10, chamber=×50
 */
export async function applyHpRegen(user: {
    id: number;
    currentHp: number;
    maxHp: number;
    lastHpUpdate: number;
    roomType?: string | null;
    roomUntil?: number;
    premiumUntil?: number;
    hermitRegen?: boolean;
}): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const HP_REGEN_SECONDS = 5;
    let hp = user.currentHp;
    const maxHp = user.maxHp;

    const regenRate = calculateHpRegenRate(user, now);

    const elapsed = now - (user.lastHpUpdate || now);
    if (elapsed > 0 && hp < maxHp) {
        // Непрерывный реген: дробные тики, HP целое
        const regenAmount = Math.floor(elapsed * regenRate / HP_REGEN_SECONDS);
        if (regenAmount > 0) {
            hp = Math.min(maxHp, hp + regenAmount);
        }
    }

    if (hp > maxHp) hp = maxHp;

    if (hp !== user.currentHp) {
        // Сохраняем остаток времени для точности
        const usedTicks = Math.floor(elapsed * regenRate / HP_REGEN_SECONDS);
        const usedSeconds = Math.ceil(usedTicks * HP_REGEN_SECONDS / regenRate);
        await db.run('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?',
            [hp, (user.lastHpUpdate || now) + usedSeconds, user.id]);
        // WS-уведомление клиенту
        const newLastHp = (user.lastHpUpdate || now) + usedSeconds;
        import('../events').then(m => m.sendToUser(user.id, { type: 'hpUpdate', currentHp: hp, maxHp, lastHpUpdate: newLastHp })).catch(() => {});
    }

    return hp;
}
