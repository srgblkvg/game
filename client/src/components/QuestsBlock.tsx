import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import Button from './ui/Button';

const questIcons: Record<string, string> = { hunt: '🗡️', arena: '⚔️', job: '🌍', craft: '⚒️', auction: '💰' };

export default function QuestsBlock({ onHighlight }: { onHighlight?: (type: string | null) => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [quests, setQuests] = useState<any>(null);

    useEffect(() => { if (user) loadQuests(); }, [user]);

    const loadQuests = async () => {
        try { setQuests(await (await fetch('/api/tavern/quests', { headers: getHeaders() })).json()); } catch {}
    };

    if (!quests) return null;

    const active = (quests.quests || []).filter((q: any) => q.status === 'active');

    return (
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 border border-[var(--color-border-default)]">
            <h3
                className="text-sm font-bold mb-2 cursor-pointer hover:text-[var(--color-accent-info)]"
                onClick={() => { onHighlight?.(null); navigate('/tavern?tab=quests'); }}
            >
                <Icon icon="game-icons:notebook" width="16" height="16" className="inline mr-1" />
                Задания: {active.length > 0 && <span className="text-xs text-[var(--color-text-muted)]">{active.length}/3</span>}
            </h3>

            {active.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic cursor-pointer" onClick={() => navigate('/tavern?tab=quests')}>
                    Нет активных заданий. Взять в таверне...
                </p>
            ) : (
                <div className="space-y-2">
                    {active.map((q: any) => {
                        const pct = Math.round((q.progress / q.requirement) * 100);
                        return (
                            <div
                                key={q.id}
                                className="rounded-lg p-2 cursor-pointer hover:ring-1 hover:ring-[var(--color-accent-info)] transition-all"
                                onClick={() => onHighlight?.(q.questType)}
                            >
                                <div className="flex items-center gap-1 text-xs mb-1">
                                    <span>{questIcons[q.questType]}</span>
                                    <span className="font-medium text-xs">{q.typeName}</span>
                                </div>
                                <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-1">{q.description}</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
                                        <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[0.6rem] text-[var(--color-text-muted)]">{q.progress}/{q.requirement}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
