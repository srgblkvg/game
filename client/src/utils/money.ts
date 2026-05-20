/**
 * Форматирует сумму в бронзе.
 * 100 бронзы = 1 серебро
 * 100 серебра = 1 золото
 */
export function formatMoney(total: number): string {
    const gold = Math.floor(total / 10000);
    const silver = Math.floor((total % 10000) / 100);
    const bronze = total % 100;

    const parts: string[] = [];
    if (gold > 0) parts.push(`${gold} золото`);
    if (silver > 0 || gold > 0) parts.push(`${silver} серебро`);
    // бронзу показываем всегда, если сумма == 0 – покажем 0 бронзы
    parts.push(`${bronze} бронза`);

    return parts.join(' ');
}