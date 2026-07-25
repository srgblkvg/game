import { useState, useEffect } from 'react';
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

const VISIBLE_LIMIT = 5;

function fmtNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'М';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'к';
    return String(n);
}

export default function AchievementsBlock() {
    const { character } = useGame();
    const [achievements, setAchievements] = useState<AchievementData[]>([]);
    const [collapsed, setCollapsed] = useState(true);
    const [showAll, setShowAll] = useState(false);
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
    const visible = showAll ? achievements : achievements.slice(0, VISIBLE_LIMIT);
    const hiddenCount = achievements.length - VISIBLE_LIMIT;

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
                <div className="mt-2 space-y-2">
                    {loading && <div className="text-xs text-[var(--color-text-muted)] text-center py-2">Загрузка...</div>}
                    {visible.map(a => {
                        const lastTier = a.tiers?.[a.tiers.length - 1];
                        const progressLabel = lastTier ? `${fmtNum(a.progress)}/${fmtNum(lastTier.threshold)}` : '?';
                        return (
                            <div key={a.key} className="flex items-center gap-2 text-xs">
                                <span className="text-base">{a.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className="truncate">{a.name}</span>
                                        {a.currentTier && (
                                            <span title={a.currentTier.name}>
                                                {a.currentTier.icon}
                                            </span>
                                        )}
                                    </div>
                                    {a.tiers && a.tiers.length > 0 && (
                                        <div className="flex gap-0.5 mt-0.5">
                                            {a.tiers.map(t => (
                                                <div
                                                    key={t.tier}
                                                    title={`${t.name}: ${fmtNum(t.threshold)}`}
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
                            </div>
                        );
                    })}
                    {hiddenCount > 0 && !showAll && (
                        <div
                            className="text-xs text-[var(--color-accent-info)] cursor-pointer hover:underline text-center py-1"
                            onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                        >
                            ещё {hiddenCount}...
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
