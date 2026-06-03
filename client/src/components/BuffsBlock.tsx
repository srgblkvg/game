import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface BuffsBlockProps {
    room?: { type: string; until: number } | null;
    drink?: { type: string; until: number } | null;
}

function formatTime(seconds: number) {
    if (seconds <= 0) return 'истекло';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

const roomNames: Record<string, string> = { closet: 'Чулан', bed: 'Койка', chamber: 'Покой' };
const roomRates: Record<string, number> = { closet: 3, bed: 10, chamber: 50 };

export default function BuffsBlock({ room, drink }: BuffsBlockProps) {
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    const hasRoom = room && room.until > now;
    const hasDrink = drink && drink.until > now;
    if (!hasRoom && !hasDrink) return null;

    return (
        <div className="w-full mt-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full p-2 flex items-center justify-between text-xs font-bold text-[var(--color-text-accent)]"
            >
                <span><Icon icon="game-icons:drink-me" width="14" height="14" className="inline mr-1" />Усиления</span>
                <Icon icon={open ? 'game-icons:chevron-up' : 'game-icons:chevron-down'} width="12" height="12" />
            </button>
            {open && (
                <div className="px-3 pb-2 space-y-1 text-xs">
                    {hasRoom && (
                        <div className="flex justify-between text-[var(--color-accent-success)]">
                            <span>Комната: {roomNames[room.type] || room.type} (×{roomRates[room.type] || '?'})</span>
                            <span>{formatTime(room.until - now)}</span>
                        </div>
                    )}
                    {hasDrink && (
                        <div className="flex justify-between text-[var(--color-accent-purple)]">
                            <span>Напиток активен</span>
                            <span>{formatTime(drink.until - now)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
