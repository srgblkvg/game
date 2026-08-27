export type WarTimeRemaining = {
    expiresInMs: number;
    hours: number;
    minutes: number;
    expired: boolean;
};

function toMs(value: string | number | Date): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return new Date(value).getTime();
}

export function getWarTimeRemaining(expiresAt: string | number | Date, nowMs: number): WarTimeRemaining {
    const expiryMs = toMs(expiresAt);
    const expiresInMs = Number.isFinite(expiryMs) ? Math.max(0, expiryMs - nowMs) : 0;
    const totalMinutes = Math.floor(expiresInMs / (1000 * 60));

    return {
        expiresInMs,
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        expired: expiresInMs === 0,
    };
}
