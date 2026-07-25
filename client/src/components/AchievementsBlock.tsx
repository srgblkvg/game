import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { getHeaders } from '../api/helpers';
import Card from './ui/Card';

interface AchievementData {
    key: string;
    name: string;
    icon: string;
    progress: number;
    highestTier: number;
    currentTier: { tier: number; name: string; icon: string } | null;
    tiers: { tier: number; name: string; icon: string; threshold: number; achieved: boolean; current: boolean }[];
}

function fmtNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'М';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'к';
    return String(n);
}

function AchievementRow({ a }: { a: AchievementData }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    const lastTier = a.tiers?.[a.tiers.length - 1];
    const progressLabel = lastTier ? `${fmtNum(a.progress)}/${fmtNum(lastTier.threshold)}` : '?';

    // Find next unearned tier
    const nextTier = a.tiers?.find(t => !t.achieved);

    const clearLongPress = useCallback(() => {
        if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        longPressRef.current = setTimeout(() => {
            setShowTooltip(true);
            // Prevent default context menu
            e.preventDefault();
        }, 500);
    };

    const handleTouchEnd = () => {
        clearLongPress();
    };

    const handleTouchMove = () => {
        clearLongPress();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowTooltip(true);
    };

    return (
        <div
            ref={rowRef}
            className="flex items-center gap-2 text-xs relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={handleContextMenu}
            onClick={() => setShowTooltip(false)}
        >
            <span className="text-base w-5 text-center flex-shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    <span className="truncate">{a.name}</span>
                    {a.currentTier && (
                        <span>{a.currentTier.icon}</span>
                    )}
                </div>
                {a.tiers && a.tiers.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                        {a.tiers.map(t => (
                            <div
                                key={t.tier}
                                className="flex-1 h-1 rounded-full"
                                style={{
                                    backgroundColor: t.achieved
                                        ? t.tier >= 4 ? '#e0245e' : t.tier >= 3 ? '#f59e0b' : t.tier >= 2 ? '#aaa' : '#cd7f32'
                                        : 'var(--color-border-default)',
                                    opacity: t.current ? 1 : t.achieved ? 0.8 : 0.3,
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
            <span className="text-[0.6rem] text-[var(--color-text-muted)] whitespace-nowrap">
                {progressLabel}
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
                    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 shadow-xl whitespace-nowrap text-xs">
                        <div className="text-[var(--color-text-primary)]">
                            {a.name}: <b>{fmtNum(a.progress)}</b>
                        </div>
                        {nextTier ? (
                            <div className="text-[var(--color-text-muted)]">
                                Следующий: {nextTier.icon} {nextTier.name} — {fmtNum(nextTier.threshold)}
                            </div>
                        ) : (
                            <div className="text-[var(--color-accent-gold)]">
                                Все уровни получены!
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AchievementsBlock() {
    const { character } = useGame();
    const [achievements, setAchievements] = useState<AchievementData[]>([]);
    const [collapsed, setCollapsed] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!character) return;
        setLoading(true);
        fetch('/api/achievements', { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setAchievements(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [character?.id]);

    const earnedCount = achievements.filter(a => a.highestTier > 0).length;
    const totalCount = achievements.length;

    if (!character || achievements.length === 0) return null;

    return (
        <Card className="mt-4 w-full" data-tutorial="achievements">
            <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setCollapsed(!collapsed)}
            >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    {collapsed ? '▶' : '▼'} 🏆 Достижения
                </h3>
                <span className="text-xs text-[var(--color-text-muted)]">
                    {earnedCount}/{totalCount}
                </span>
            </div>

            {!collapsed && (
                <div className="mt-2 space-y-2 max-h-[11.5rem] overflow-y-auto pr-1">
                    {loading && <div className="text-xs text-[var(--color-text-muted)] text-center py-2">Загрузка...</div>}
                    {achievements.map(a => (
                        <AchievementRow key={a.key} a={a} />
                    ))}
                </div>
            )}
        </Card>
    );
}
