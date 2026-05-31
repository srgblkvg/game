/**
 * Форматирует сумму в серебре.
 */
export function formatMoney(total: number): string {
    return `${total.toLocaleString()} сер.`;
}
