import { safeDate } from './date';

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

/**
 * Форматирует время последней активности: «сейчас», «59 мин», «23 ч.», «29 дн.», «11м», «3 г.»
 * Принимает unix timestamp (секунды), Date объект, или ISO строку
 */
export function formatLastSeen(value: any): string {
    if (value == null) return '—';

    let date: Date;
    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'number') {
        date = new Date(value * 1000);
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
        date = new Date(Number(value) * 1000);
    } else {
        const d = safeDate(value);
        if (!d) return '—';
        date = d;
    }

    if (isNaN(date.getTime())) return '—';

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'сейчас';

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} мин`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} ч.`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} дн.`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}м`;

    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} г.`;
}

/** Возвращает {text, online} — online=true если lastLoginAt ≤ 5 мин назад */
export function getLastSeen(value: any): { text: string; online: boolean } {
    const text = formatLastSeen(value);
    if (text === '—' || value == null) return { text, online: false };

    let date: Date;
    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'number') {
        date = new Date(value * 1000);
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
        date = new Date(Number(value) * 1000);
    } else {
        const d = safeDate(value);
        if (!d) return { text, online: false };
        date = d;
    }

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    return { text, online: diffSec < 300 };
}
