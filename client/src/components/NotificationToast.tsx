import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

interface Notification {
    id: number;
    type: 'quest_complete' | 'level_up' | 'battle_result' | 'guild_event' | 'auction_won' | 'auction_outbid' | 'auction_sold' | 'system';
    message: string;
    data?: any;
    createdAt: number;
}

const iconMap: Record<string, string> = {
    quest_complete: 'game-icons:notebook',
    level_up: 'game-icons:level-end-flag',
    battle_result: 'game-icons:crossed-swords',
    guild_event: 'game-icons:castle',
    auction_won: 'game-icons:cash',
    auction_outbid: 'game-icons:cash',
    auction_sold: 'game-icons:cash',
    system: 'game-icons:info',
};

const colorMap: Record<string, string> = {
    quest_complete: '#f0c040',
    level_up: '#40c0f0',
    battle_result: '#f04040',
    guild_event: '#c040f0',
    auction_won: '#40f040',
    auction_outbid: '#f08040',
    auction_sold: '#f0c040',
    system: '#888888',
};

interface ToastItem extends Notification {
    id: number;
    fading: boolean;
}

export default function NotificationToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const shownRef = new Set<number>();

    // Слушаем уведомления из serverTick
    useEffect(() => {
        const handler = (e: Event) => {
            const notifications = (e as CustomEvent).detail as Notification[];
            if (!notifications || notifications.length === 0) return;
            setToasts(prev => {
                const next = [...prev];
                for (const n of notifications) {
                    if (shownRef.has(n.id)) continue;
                    shownRef.add(n.id);
                    next.push({ ...n, fading: false });
                }
                // Ограничиваем 10 тостами
                if (next.length > 10) return next.slice(-10);
                return next;
            });
        };
        window.addEventListener('notifications', handler);
        return () => window.removeEventListener('notifications', handler);
    }, []);

    // Автоудаление через 5 секунд (с фейдом)
    useEffect(() => {
        if (toasts.length === 0) return;
        const timers = toasts.map(t => {
            return setTimeout(() => {
                setToasts(prev => prev.map(p => p.id === t.id ? { ...p, fading: true } : p));
                // Удаляем через 300ms после фейда
                setTimeout(() => {
                    setToasts(prev => prev.filter(p => p.id !== t.id));
                }, 300);
            }, 5000);
        });
        return () => timers.forEach(clearTimeout);
    }, [toasts]);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.map(p => p.id === id ? { ...p, fading: true } : p));
        setTimeout(() => {
            setToasts(prev => prev.filter(p => p.id !== id));
        }, 300);
    }, []);

    if (toasts.length === 0) return null;

    return createPortal(
        <div className="fixed top-14 right-3 z-[100] flex flex-col gap-2 max-w-[340px] pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`pointer-events-auto bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg px-3 py-2.5 shadow-lg flex items-start gap-2 transition-all duration-300 ${
                        t.fading ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                    }`}
                    onClick={() => dismiss(t.id)}
                >
                    <Icon
                        icon={iconMap[t.type] || 'game-icons:ringing-bell'}
                        width="18" height="18"
                        className="mt-0.5 shrink-0"
                        style={{ color: colorMap[t.type] || '#888' }}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--color-text-primary)] leading-snug">{t.message}</p>
                        {t.data && (
                            <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-0.5">{t.data}</p>
                        )}
                    </div>
                    <button
                        className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] leading-none mt-0.5"
                        onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                    >
                        <Icon icon="game-icons:cross-mark" width="14" height="14" />
                    </button>
                </div>
            ))}
        </div>,
        document.body
    );
}
