import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import Card from './ui/Card';

interface BuffsBlockProps {
    room?: { type: string; until: number } | null;
    drink?: { type: string; until: number } | null;
    premium?: { until: number } | null;
    inventory?: any[];
    equipment?: Record<string, any>;
}

function formatTime(seconds: number) {
    if (seconds <= 0) return 'истекло';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} дн ${h} ч ${m} мин`;
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

export default function BuffsBlock({ room, drink, premium, inventory, equipment }: BuffsBlockProps) {
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));
    const [collapsed, setCollapsed] = useState(true);
    const [hasCollectionItems, setHasCollectionItems] = useState(false);
    const [collectionPercent, setCollectionPercent] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    // Индикатор: синхронно по inventory/equipment + коллекции
    useEffect(() => {
        fetch('/api/collections', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any) => {
                const collSet = new Set<string>();
                const collItems = data.items || [];
                for (const c of collItems) {
                    collSet.add(`${c.itemName}|${c.slot}`);
                }
                const inv = inventory || [];
                const eq = equipment || {};
                const equippedNames = new Set<string>();
                for (const slot of Object.values(eq)) {
                    if ((slot as any)?.name && (slot as any)?.slot) {
                        equippedNames.add(`${(slot as any).name}|${(slot as any).slot}`);
                    }
                }
                const hasAddable = inv.some((invItem: any) =>
                    invItem.name && invItem.slot &&
                    !collSet.has(`${invItem.name}|${invItem.slot}`) &&
                    !equippedNames.has(`${invItem.name}|${invItem.slot}`)
                );
                setHasCollectionItems(hasAddable);
            })
            .catch(() => {});
    }, [inventory, equipment]);

    // Процент коллекции: загружаем один раз
    useEffect(() => {
        fetch('/api/collections', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any) => {
                const sets = data.sets || [];
                const collItems = data.items || [];
                const totalItems = sets.reduce((sum: number, s: any) => sum + (s.totalItems || 0), 0);
                const pct = totalItems > 0 ? Math.round((collItems.length / totalItems) * 100) : 0;
                setCollectionPercent(pct);
            })
            .catch(() => {});
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
                    {hasCollectionItems && (
                        <span className="w-2 h-2 rounded-full bg-[#2ecc71] flex-shrink-0" />
                    )}
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                    {activeCount > 0 ? `${activeCount} акт.` : 'Нет'}
                </span>
            </div>

            {!collapsed && (
                <div className="mt-3 space-y-3">
                    {/* Временные */}
                    <div>
                        <div className="text-[0.7rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                            <Icon icon="game-icons:hourglass" width="11" height="11" /> Временные
                        </div>
                        <div className="space-y-0.5">
                            {/* Комната */}
                            <div
                                className="flex justify-between text-xs py-1 border-b border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-bg-hover)] rounded px-1 -mx-1"
                                onClick={() => navigate('/tavern?tab=room')}
                            >
                                <span className={hasRoom ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}>
                                    Комната{hasRoom && room ? `: ${roomNames[room.type] || room.type} (×${roomRates[room.type] || '?'})` : ''}
                                </span>
                                <span className="text-[var(--color-text-muted)]">
                                    {hasRoom && room ? formatTime(room.until - now) : 'Отсутствует'}
                                </span>
                            </div>

                            {/* Напиток */}
                            <div
                                className="flex justify-between text-xs py-1 border-b border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-bg-hover)] rounded px-1 -mx-1"
                                onClick={() => navigate('/tavern?tab=drink')}
                            >
                                <span className={hasDrink ? 'text-[var(--color-accent-purple)]' : 'text-[var(--color-text-muted)]'}>
                                    Напиток{hasDrink && drink ? `: ${drinkNames[drink.type] || drink.type}` : ''}
                                </span>
                                <span className="text-[var(--color-text-muted)]">
                                    {hasDrink && drink ? formatTime(drink.until - now) : 'Отсутствует'}
                                </span>
                            </div>

                            {/* Премиум */}
                            <div
                                className="flex justify-between text-xs py-1 cursor-pointer hover:bg-[var(--color-bg-hover)] rounded px-1 -mx-1"
                                onClick={() => navigate('/premium')}
                            >
                                <span className={hasPremium ? 'text-[var(--color-accent-gold)]' : 'text-[var(--color-text-muted)]'} style={hasPremium ? { color: '#f1c40f' } : undefined}>
                                    Премиум
                                </span>
                                <span className="text-[var(--color-text-muted)]">
                                    {hasPremium && premium ? formatTime(premium.until - now) : 'Отсутствует'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Разделитель */}
                    <div className="border-t border-[var(--color-border-light)]" />

                    {/* Постоянные */}
                    <div>
                        <div className="text-[0.7rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                            <Icon icon="game-icons:infinity" width="11" height="11" /> Постоянные
                        </div>
                        <div className="flex justify-between text-xs py-1 text-[var(--color-text-muted)] rounded px-1 -mx-1 cursor-pointer hover:bg-[var(--color-bg-hover)]" onClick={() => navigate('/collections')}>
                            <span className="flex items-center gap-1.5">
                                Коллекция
                                {hasCollectionItems && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71] flex-shrink-0" />
                                )}
                            </span>
                            <span>{collectionPercent}%</span>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
