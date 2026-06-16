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
    collectionCount?: number;
    totalCollectionItems?: number;
}

function formatTime(seconds: number) {
    if (seconds <= 0) return 'истекло';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} дн ${h} ч`;
    if (h > 0) return `${h} ч ${m} мин`;
    return `${m} мин`;
}

const roomNames: Record<string, string> = { closet: 'Чулан', bed: 'Койка', chamber: 'Покой' };
const roomIcons: Record<string, string> = { closet: 'game-icons:wooden-crate', bed: 'game-icons:bed', chamber: 'game-icons:castle' };
const roomRates: Record<string, number> = { closet: 3, bed: 10, chamber: 50 };

const drinkNames: Record<string, string> = {
    rage_small: 'Настойка ярости', rage_med: 'Крепкая настойка ярости', rage_big: 'Эликсир берсерка',
    shadow_small: 'Настойка теней', shadow_med: 'Крепкая настойка теней', shadow_big: 'Эликсир призрака',
    stone_small: 'Настойка камня', stone_med: 'Крепкая настойка камня', stone_big: 'Эликсир бастиона',
    eye_small: 'Настойка ока', eye_med: 'Крепкая настойка ока', eye_big: 'Эликсир пророка',
    grog_small: 'Грог Моры', grog_med: 'Крепкий грог', dragon_blood: 'Кровь дракона',
};

export default function BuffsBlock({ room, drink, premium, inventory, equipment, collectionCount = 0, totalCollectionItems = 189 }: BuffsBlockProps) {
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));
    const [collapsed, setCollapsed] = useState(true);
    const [hasCollectionItems, setHasCollectionItems] = useState(false);
    const collectionPercent = Math.round((collectionCount / totalCollectionItems) * 100);
    const navigate = useNavigate();

    useEffect(() => {
        const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        fetch('/api/collections', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any) => {
                const collSet = new Set<string>();
                for (const c of (data.items || [])) collSet.add(`${c.itemName}|${c.slot}`);

                const inv = inventory || [];
                const eq = equipment || {};
                const equippedNames = new Set<string>();
                for (const slot of Object.values(eq)) {
                    if ((slot as any)?.name && (slot as any)?.slot) equippedNames.add(`${(slot as any).name}|${(slot as any).slot}`);
                }
                const hasAddable = inv.some((invItem: any) =>
                    invItem.name && invItem.slot && !collSet.has(`${invItem.name}|${invItem.slot}`) && !equippedNames.has(`${invItem.name}|${invItem.slot}`)
                );
                setHasCollectionItems(hasAddable);

                const sets = data.sets || [];
            })
            .catch(() => {});
    }, [inventory, equipment]);

    const hasRoom = room && room.until > now;
    const hasDrink = drink && drink.until > now;
    const hasPremium = premium && premium.until > now;
    const activeCount = [hasRoom, hasDrink, hasPremium].filter(Boolean).length;

    const activeList = [
        hasRoom && `🏠 ${roomNames[room!.type] || room!.type}`,
        hasDrink && `🍺 ${drinkNames[drink!.type] || drink!.type}`,
        hasPremium && '⭐ Премиум',
    ].filter(Boolean).join(', ');

    return (
        <Card className="mt-4 w-full overflow-hidden">
            <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs flex-shrink-0">{collapsed ? '▶' : '▼'}</span>
                    <h3 className="font-bold text-sm flex-shrink-0">Усиления</h3>
                    {hasCollectionItems && <span className="w-2 h-2 rounded-full bg-[#2ecc71] flex-shrink-0" />}
                    {collapsed && activeList && (
                        <span className="text-xs text-[var(--color-text-muted)] truncate">{activeList}</span>
                    )}
                </div>
                <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-2">
                    {activeCount > 0 ? `${activeCount} акт.` : 'Нет'}
                </span>
            </div>

            {!collapsed && (
                <div className="mt-2 space-y-2">
                    {/* Временные */}
                    <div className="space-y-0.5">
                        <div className="text-[0.65rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1">
                            <Icon icon="game-icons:hourglass" width="10" height="10" /> Временные
                        </div>

                        {/* Комната */}
                        <BuffRow
                            icon={hasRoom && room ? roomIcons[room.type] || 'game-icons:wooden-crate' : 'game-icons:wooden-crate'}
                            label="Комната"
                            active={!!hasRoom}
                            detail={hasRoom && room ? `${roomNames[room.type] || room.type} ×${roomRates[room.type] || '?'}` : ''}
                            time={hasRoom && room ? formatTime(room.until - now) : '—'}
                            onClick={() => navigate('/tavern?tab=room')}
                        />

                        {/* Напиток */}
                        <BuffRow
                            icon="game-icons:beer-bottle"
                            label="Напиток"
                            active={!!hasDrink}
                            detail={hasDrink && drink ? drinkNames[drink.type] || drink.type : ''}
                            time={hasDrink && drink ? formatTime(drink.until - now) : '—'}
                            onClick={() => navigate('/tavern?tab=drink')}
                        />

                        {/* Премиум */}
                        <BuffRow
                            icon="game-icons:star-formation"
                            label="Премиум"
                            active={!!hasPremium}
                            time={hasPremium && premium ? formatTime(premium.until - now) : '—'}
                            onClick={() => navigate('/premium')}
                        />
                    </div>

                    {/* Разделитель */}
                    <div className="border-t border-[var(--color-border-light)]" />

                    {/* Постоянные */}
                    <div>
                        <div className="text-[0.65rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                            <Icon icon="game-icons:infinity" width="10" height="10" /> Постоянные
                        </div>
                        <div className="cursor-pointer hover:bg-[var(--color-bg-hover)] rounded px-1 -mx-1 py-0.5" onClick={() => navigate('/collections')}>
                            <div className="flex justify-between items-center text-xs mb-0.5">
                                <span className="flex items-center gap-1.5">
                                    <Icon icon="game-icons:book-cover" width="12" height="12" className="text-[var(--color-text-muted)]" />
                                    Коллекция
                                    {hasCollectionItems && <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71]" />}
                                </span>
                                <span className="text-[var(--color-text-muted)]">{collectionPercent}%</span>
                            </div>
                            <div className="w-full h-1 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--color-accent-gold)] rounded-full transition-all duration-500"
                                    style={{ width: `${collectionPercent}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

function BuffRow({ icon, label, active, detail, time, onClick }: {
    icon: string; label: string; active: boolean; detail?: string; time: string; onClick: () => void;
}) {
    return (
        <div className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-[var(--color-bg-hover)] rounded px-1 -mx-1" onClick={onClick}>
            <Icon icon={icon} width="12" height="12" className={active ? 'text-[var(--color-accent-gold)]' : 'text-[var(--color-text-muted)]'} />
            <span className={active ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}>
                {label}{detail ? `: ${detail}` : ''}
            </span>
            <span className="ml-auto text-[var(--color-text-muted)] tabular-nums">{time}</span>
        </div>
    );
}
