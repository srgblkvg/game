import db from '../database';

/**
 * Применяет офлайн-регенерацию HP для игрока.
 * Возвращает актуальное currentHp и обновляет БД если изменилось.
 *
 * Реген: 1 HP каждые 10 сек (базовый), ускорение от комнаты:
 *   closet=×3, bed=×10, chamber=×50
 */
export function applyHpRegen(user: {
    id: number;
    currentHp: number;
    maxHp: number;
    lastHpUpdate: number;
    roomType?: string | null;
    roomUntil?: number;
}): number {
    const now = Math.floor(Date.now() / 1000);
    const HP_REGEN_SECONDS = 10;
    let hp = user.currentHp;
    const maxHp = user.maxHp;

    let regenRate = 1;
    if (user.roomType && (user.roomUntil || 0) > now) {
        if (user.roomType === 'closet') regenRate = 3;
        else if (user.roomType === 'bed') regenRate = 10;
        else if (user.roomType === 'chamber') regenRate = 50;
    }

    const elapsed = now - (user.lastHpUpdate || now);
    if (elapsed > 0 && hp < maxHp) {
        const regenAmount = Math.floor(elapsed / HP_REGEN_SECONDS) * regenRate;
        if (regenAmount > 0) {
            hp = Math.min(maxHp, hp + regenAmount);
        }
    }

    if (hp > maxHp) hp = maxHp;

    if (hp !== user.currentHp) {
        await db.prepare('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?').run(hp, now - (elapsed % HP_REGEN_SECONDS), user.id);
    }

    return hp;
}
