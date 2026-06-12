/**
 * Форматирует время игры (UTC) в единый формат ЧЧ:ММ
 * date может быть строкой ISO, числом (unix ms) или Date
 * Строки без часового пояса считаются UTC
 */
export function formatGameTime(date: string | number | Date): string {
    const d = typeof date === 'string' && !date.endsWith('Z') && !date.includes('+') && !date.includes('T')
        ? new Date(date + 'Z')
        : new Date(date);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Форматирует дату+время игры (UTC): ДД.ММ ЧЧ:ММ
 * Строки без часового пояса считаются UTC
 */
export function formatGameDateTime(date: string | number | Date): string {
    const d = typeof date === 'string' && !date.endsWith('Z') && !date.includes('+') && !date.includes('T')
        ? new Date(date + 'Z')
        : new Date(date);
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${day}.${month} ${h}:${m}`;
}
