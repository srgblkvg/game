import { useState, useEffect } from 'react';

let _serverTime = Math.floor(Date.now() / 1000);

// Глобальный слушатель serverTick — чтобы не вешать по слушателю на каждый компонент
if (typeof window !== 'undefined') {
    window.addEventListener('serverTick', ((e: Event) => {
        _serverTime = (e as CustomEvent).detail;
    }) as EventListener);
}

/** Хук: текущее серверное время (обновляется каждую секунду через WS).
 *  Используй getRemaining(endTime) для получения оставшихся секунд. */
export function useServerTime() {
    const [time, setTime] = useState(_serverTime);

    useEffect(() => {
        const handler = (e: Event) => setTime((e as CustomEvent).detail);
        window.addEventListener('serverTick', handler as EventListener);
        return () => window.removeEventListener('serverTick', handler as EventListener);
    }, []);

    return time;
}

/** Оставшиеся секунды до endTime (unixtime). Минимум 0. */
export function getRemaining(endTime: number): number {
    return Math.max(0, (endTime || 0) - _serverTime);
}

/** Формат: MM:SS или HH:MM:SS */
export function formatRemaining(seconds: number): string {
    if (seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
