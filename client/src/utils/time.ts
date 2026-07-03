/**
 * Форматирует время игры в ЛОКАЛЬНОМ часовом поясе пользователя (браузера).
 * Сервер хранит/передаёт время в UTC, конвертация только здесь.
 *
 * date может быть строкой ISO, числом (unix ms) или Date.
 * Строки без часового пояса считаются UTC.
 */
export function formatGameTime(date: string | number | Date): string {
    const d = typeof date === 'string' && !date.endsWith('Z') && !date.includes('+') && !date.includes('T')
        ? new Date(date + 'Z')
        : new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Форматирует дату+время игры в ЛОКАЛЬНОМ часовом поясе: ДД.ММ ЧЧ:ММ
 * Сервер хранит/передаёт время в UTC, конвертация только здесь.
 * Строки без часового пояса считаются UTC
 */
export function formatGameDateTime(date: string | number | Date): string {
    if (date === null || date === undefined || date === "") return "—";
    const d = typeof date === 'string' && !date.endsWith('Z') && !date.includes('+') && !date.includes('T')
        ? new Date(date + 'Z')
        : new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${day}.${month} ${h}:${m}`;
}
