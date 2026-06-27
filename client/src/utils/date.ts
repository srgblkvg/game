/**
 * Безопасное форматирование даты из разных форматов (epoch string/number, ISO string).
 */
export function safeDate(value: any): Date | null {
    if (value == null) return null;
    if (typeof value === 'number') return new Date(value * 1000);
    if (typeof value === 'string') {
        if (/^\d+$/.test(value)) return new Date(Number(value) * 1000);
        // Нормализуем: +00 → +00:00, пробел → T, затем Z если нет таймзоны
        let s = value.replace(' ', 'T');
        s = s.replace(/([+-]\d{2})$/, '$1:00');  // +00 → +00:00
        const hasTZ = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
        return new Date(s + (hasTZ ? '' : 'Z'));
    }
    return null;
}

export function fmtSafeDate(value: any, options?: Intl.DateTimeFormatOptions): string {
    const d = safeDate(value);
    if (!d) return '—';
    try {
        return d.toLocaleString('ru-RU', { timeZone: 'UTC', ...options });
    } catch {
        return d.toLocaleString('ru-RU', options);
    }
}
