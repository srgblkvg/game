/**
 * Форматирует сумму в серебре с правильным окончанием.
 */
export function formatMoney(total: number | null | undefined): string {
    if (total == null) total = 0;
    const lastTwo = total % 100;
    const lastOne = total % 10;
    // 1, 21, 31, ... но не 11
    const word = (lastOne === 1 && lastTwo !== 11) ? 'серебро' : 'серебра';
    return `${total.toLocaleString()} ${word}`;
}
