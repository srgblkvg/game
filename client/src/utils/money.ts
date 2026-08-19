export type MoneyAmount = number;
export type PriceAmount = number;
export type SilverAmount = MoneyAmount | PriceAmount;

export function formatSilverNumber(total: SilverAmount | null | undefined): string {
    return Number(total ?? 0).toLocaleString('ru-RU');
}

/** Форматирует сумму в серебре с правильным окончанием. */
export function formatMoney(total: SilverAmount | null | undefined): string {
    const amount = Number(total ?? 0);
    const lastTwo = amount % 100;
    const lastOne = amount % 10;
    // 1, 21, 31, ... но не 11
    const word = (lastOne === 1 && lastTwo !== 11) ? 'серебро' : 'серебра';
    return `${formatSilverNumber(amount)} ${word}`;
}

/** Компактное число: 1 200 → 1.2K, 1 500 000 → 1.5M */
export function formatNum(n: number | null | undefined): string {
    if (n == null) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
    return n.toLocaleString();
}

export const formatSilverAmount = formatMoney;
