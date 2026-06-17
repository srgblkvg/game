import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';

const questIcons: Record<string, string> = { hunt: '🗡️', arena: '⚔️', job: '🌍', craft: '⚒️', auction: '💰' };
const guildQuestIcons: Record<string, string> = { pve: '🗡️', pvp: '⚔️', craft: '⚒️', donate: '🏦', jobs: '🌍' };

export default function QuestsBlock({ onHighlight }: { onHighlight?: (type: string | null) => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [quests, setQuests] = useState<any>(null);
    const [guildQuest, setGuildQuest] = useState<any>(null);

    useEffect(() => {
        if (user) {
            loadQuests();
            loadGuildQuest();
            const i = setInterval(loadQuests, 10000);
            return () => clearInterval(i);
        }
    }, [user]);

    // WS live updates for guild quest
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) setGuildQuest(detail);
        };
        window.addEventListener('guildQuestProgress', handler);
        return () => window.removeEventListener('guildQuestProgress', handler);
    }, []);

    const loadQuests = async () => {
        try { setQuests(await (await fetch('/api/tavern/quests', { headers: getHeaders() })).json()); } catch { }
    };

    const loadGuildQuest = async () => {
        try {
            const r = await fetch('/api/guild/quest', { headers: getHeaders() });
            if (r.status === 400) { setGuildQuest(null); return; } // not in guild
            const d = await r.json();
            setGuildQuest(d.activeQuest);
        } catch { }
    };

    const active = (quests?.quests || []).filter((q: any) => q.status === 'active');
    const hasGuild = !!guildQuest;
    const hasPersonal = active.length > 0;

    if (!hasGuild && !hasPersonal) return null;

    return (
        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
            <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-text-accent)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap"
                onClick={() => { onHighlight?.(null); navigate('/tavern?tab=quests'); }}>
                <Icon icon="game-icons:notebook" width="18" height="18" />Задания{active.length > 0 && <span className="text-xs text-[var(--color-text-muted)] ml-1">{active.length}/3</span>}
            </h3>

            <div className="space-y-2">
                {/* Гильдия */}
                {hasGuild && (
                    <div>
                        <div className="text-[0.6rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Гильдия:</div>
                        <GuildQuestItem quest={guildQuest} onNavigate={() => navigate('/guild')} />
                    </div>
                )}

                {/* Личные */}
                {hasPersonal && (
                    <div>
                        <div className="text-[0.6rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Личные:</div>
                        <div className="space-y-1.5">
                            {active.map((q: any) => {
                                const pct = Math.round((q.progress / q.requirement) * 100);
                                return (
                                    <div key={q.id} className="cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => q.progress >= q.requirement ? navigate('/tavern?tab=quests') : onHighlight?.(q.questType)}>
                                        <div className="flex items-center gap-1 text-xs">
                                            <span>{questIcons[q.questType]}</span>
                                            <span className="font-medium">{q.typeName}</span>
                                            <span className="text-[0.65rem] text-[var(--color-text-muted)] ml-auto">{q.progress}/{q.requirement}</span>
                                        </div>
                                        <p className="text-[0.65rem] text-[var(--color-text-muted)] leading-tight">{q.description}</p>
                                        <div className="h-1 bg-[var(--color-bg-hover)] rounded-full overflow-hidden mt-0.5">
                                            <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function GuildQuestItem({ quest, onNavigate }: { quest: any; onNavigate: () => void }) {
    if (!quest) return null;
    const pct = Math.round((quest.progress / quest.requirement) * 100);
    return (
        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={onNavigate}>
            <div className="flex items-center gap-1 text-xs">
                <span>{guildQuestIcons[quest.questType] || '📋'}</span>
                <span className="font-medium">{quest.typeName}</span>
                <span className="text-[0.65rem] text-[var(--color-text-muted)] ml-auto">{quest.progress}/{quest.requirement}</span>
            </div>
            <p className="text-[0.65rem] text-[var(--color-text-muted)] leading-tight">{quest.description}</p>
            <div className="flex items-center gap-1 text-[0.6rem] text-[var(--color-text-muted)]">
                <span>{quest.difficultyLabel}</span>
                <span>· +{quest.rewardXp} XP</span>
            </div>
            <div className="h-1 bg-[var(--color-bg-hover)] rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-[var(--color-accent-warning)] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
