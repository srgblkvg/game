// Бонусы напитков (ключ → статы)
export const DRINK_BONUSES: Record<string, { s: number; a: number; d: number; m: number }> = {
    rage_small: { s: 10, a: 0, d: 0, m: 0 },
    rage_med: { s: 25, a: 0, d: 0, m: 0 },
    rage_big: { s: 50, a: 0, d: 0, m: 0 },
    shadow_small: { s: 0, a: 10, d: 0, m: 0 },
    shadow_med: { s: 0, a: 25, d: 0, m: 0 },
    shadow_big: { s: 0, a: 50, d: 0, m: 0 },
    stone_small: { s: 0, a: 0, d: 10, m: 0 },
    stone_med: { s: 0, a: 0, d: 25, m: 0 },
    stone_big: { s: 0, a: 0, d: 50, m: 0 },
    eye_small: { s: 0, a: 0, d: 0, m: 10 },
    eye_med: { s: 0, a: 0, d: 0, m: 25 },
    eye_big: { s: 0, a: 0, d: 0, m: 50 },
    grog_small: { s: 5, a: 5, d: 5, m: 5 },
    grog_med: { s: 12, a: 12, d: 12, m: 12 },
    dragon_blood: { s: 30, a: 30, d: 30, m: 30 },
};

const empty = { s: 0, a: 0, d: 0, m: 0 };

export function getDrinkBonuses(user: any): { s: number; a: number; d: number; m: number } {
    const now = Math.floor(Date.now() / 1000);
    if (!user.activeDrink || !user.drinkUntil || user.drinkUntil <= now) return empty;
    return DRINK_BONUSES[user.activeDrink] || empty;
}
