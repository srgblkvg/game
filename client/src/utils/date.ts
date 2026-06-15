/**
 * Безопасное форматирование даты из разных форматов (epoch string/number, ISO string).
 */
export function safeDate(value: any): Date | null {
    if (value == null) return null;
    if (typeof value === 'number') return new Date(value * 1000);
    if (typeof value === 'string') {
        if (/^\d+$/.test(value)) return new Date(Number(value) * 1000);
        // Проверяем, есть ли уже таймзона (Z, +00, +00:00, -05 и т.д.)
        const hasTZ = value.endsWith('Z') || /[+-]\d{2}/.test(value.slice(-6));
        return new Date(value.replace(' ', 'T') + (hasTZ ? '' : 'Z'));
    }
    return null;
}

export function fmtSafeDate(value: any, options?: Intl.DateTimeFormatOptions): string {
    const d = safeDate(value);
    return d ? d.toLocaleString('ru-RU', options) : '—';
}
