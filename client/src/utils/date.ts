/**
 * Безопасное форматирование даты из разных форматов (epoch string/number, ISO string).
 */
export function safeDate(value: any): Date | null {
    if (value == null) return null;
    if (typeof value === 'number') return new Date(value * 1000);
    if (typeof value === 'string') {
        if (/^\d+$/.test(value)) return new Date(Number(value) * 1000);
        return new Date(value.replace(' ', 'T') + 'Z');
    }
    return null;
}
