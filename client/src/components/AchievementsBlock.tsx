import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { getHeaders } from '../api/helpers';

interface AchievementData {
    key: string;
    name: string;
    icon: string;
    progress: number;
    highestTier: number;
    currentTier: { tier: number; name: string; icon: string } | null;
    tiers: { tier: number; name: string; icon: string; threshold: number; achieved: boolean; current: boolean }[];
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
        <div className="w-full max-w-2xl mx-auto bg-[var(--color-bg-secondary)] rounded-xl border-2 border-[var(--color-border-light)] text-[var(--color-text-primary)] overflow-hidden">
            <div
                className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-[var(--color-bg-hover)]"
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
                <div className="px-3 pb-3 space-y-2 max-h-80 overflow-y-auto">
                    {loading && <div className="text-xs text-[var(--color-text-muted)] text-center py-2">Загрузка...</div>}
                    {achievements.map(a => (
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
                                {/* Progress bar */}
                                {a.tiers && a.tiers.length > 0 && (
                                    <div className="flex gap-0.5 mt-0.5">
                                        {a.tiers.map(t => (
                                            <div
                                                key={t.tier}
                                                title={`${t.name}: ${t.threshold}`}
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
                                {a.progress}/{a.tiers?.[a.tiers.length - 1]?.threshold || '?'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
