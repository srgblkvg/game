import { useState, useEffect } from 'react';
import Card from './ui/Card';

interface BuffsBlockProps {
    room?: { type: string; until: number } | null;
    drink?: { type: string; until: number } | null;
    premium?: { until: number } | null;
}

function formatTime(seconds: number) {
    if (seconds <= 0) return 'истекло';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

const roomNames: Record<string, string> = { closet: 'Чулан', bed: 'Койка', chamber: 'Покой' };
const roomRates: Record<string, number> = { closet: 3, bed: 10, chamber: 50 };

const drinkNames: Record<string, string> = {
    rage_small: 'Настойка ярости', rage_med: 'Крепкая настойка ярости', rage_big: 'Эликсир берсерка',
    shadow_small: 'Настойка теней', shadow_med: 'Крепкая настойка теней', shadow_big: 'Эликсир призрака',
    stone_small: 'Настойка камня', stone_med: 'Крепкая настойка камня', stone_big: 'Эликсир бастиона',
    eye_small: 'Настойка ока', eye_med: 'Крепкая настойка ока', eye_big: 'Эликсир пророка',
    grog_small: 'Грог Моры', grog_med: 'Крепкий грог', dragon_blood: 'Кровь дракона',
};

export default function BuffsBlock({ room, drink, premium }: BuffsBlockProps) {
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    const hasRoom = room && room.until > now;
    const hasDrink = drink && drink.until > now;
    const hasPremium = premium && premium.until > now;
    const activeCount = [hasRoom, hasDrink, hasPremium].filter(Boolean).length;

    return (
        <Card className="mt-4 w-full">
            <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setCollapsed(!collapsed)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm">{collapsed ? '▶' : '▼'}</span>
                    <h3 className="font-bold text-sm">Усиления</h3>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                    {activeCount > 0 ? `${activeCount} акт.` : 'Нет'}
                </span>
            </div>

            {!collapsed && (
                <div className="mt-2">
                    {!hasRoom && !hasDrink && !hasPremium ? (
                        <p className="text-xs text-[var(--color-text-muted)] py-1">
                            Нет активных усилений
                        </p>
                    ) : (
                        <div className="space-y-1">
                            {hasRoom ? (
                                <div className="flex justify-between text-xs py-1 border-b border-[var(--color-border-light)] last:border-b-0">
                                    <span className="text-[var(--color-accent-success)]">
                                        Комната: {roomNames[room!.type] || room!.type} (×{roomRates[room!.type] || '?'})
                                    </span>
                                    <span className="text-[var(--color-text-muted)]">{formatTime(room!.until - now)}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-xs py-1 border-b border-[var(--color-border-light)] last:border-b-0">
                                    <span className="text-[var(--color-text-muted)]">Комната</span>
                                    <span className="text-[var(--color-text-muted)]">Отсутствует</span>
                                </div>
                            )}
                            {hasDrink ? (
                                <div className="flex justify-between text-xs py-1 border-b border-[var(--color-border-light)] last:border-b-0">
                                    <span className="text-[var(--color-accent-purple)]">
                                        Напиток: {drinkNames[drink!.type] || drink!.type}
                                    </span>
                                    <span className="text-[var(--color-text-muted)]">{formatTime(drink!.until - now)}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-xs py-1 border-b border-[var(--color-border-light)] last:border-b-0">
                                    <span className="text-[var(--color-text-muted)]">Напиток</span>
                                    <span className="text-[var(--color-text-muted)]">Отсутствует</span>
                                </div>
                            )}
                            {hasPremium ? (
                                <div className="flex justify-between text-xs py-1">
                                    <span className="text-[var(--color-accent-gold)]" style={{ color: '#f1c40f' }}>
                                        Премиум (+30% золота, кулдаун ×0.5)
                                    </span>
                                    <span className="text-[var(--color-text-muted)]">{formatTime(premium!.until - now)}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-xs py-1">
                                    <span className="text-[var(--color-text-muted)]">Премиум</span>
                                    <span className="text-[var(--color-text-muted)]">Отсутствует</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
