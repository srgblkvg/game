import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';

const questIcons: Record<string, string> = { hunt: '🗡️', arena: '⚔️', job: '🌍', craft: '⚒️', auction: '💰' };

export default function QuestsBlock({ onHighlight }: { onHighlight?: (type: string | null) => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [quests, setQuests] = useState<any>(null);

    useEffect(() => { if (user) loadQuests(); }, [user]);
    const loadQuests = async () => { try { setQuests(await (await fetch('/api/tavern/quests',{headers:getHeaders()})).json()); } catch{} };
    if (!quests) return null;

    const active = (quests.quests || []).filter((q: any) => q.status === 'active');

    return (
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-2 border border-[var(--color-border-default)]">
            <h3 className="text-xs font-bold mb-1.5 cursor-pointer hover:text-[var(--color-accent-info)]" onClick={()=>{onHighlight?.(null);navigate('/tavern?tab=quests');}}>
                <Icon icon="game-icons:notebook" width="14" height="14" className="inline mr-1" />Задания{active.length>0 && <span className="text-[0.65rem] text-[var(--color-text-muted)] ml-1">{active.length}/3</span>}
            </h3>
            {active.length===0 ? (
                <p className="text-[0.65rem] text-[var(--color-text-muted)] italic cursor-pointer" onClick={()=>navigate('/tavern?tab=quests')}>Нет активных заданий</p>
            ) : (
                <div className="space-y-1.5">
                    {active.map((q: any) => {
                        const pct = Math.round((q.progress/q.requirement)*100);
                        return (
                            <div key={q.id} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/tavern?tab=quests')}>
                                <div className="flex items-center gap-1 text-[0.65rem]">
                                    <span>{questIcons[q.questType]}</span>
                                    <span className="font-medium">{q.typeName}</span>
                                    <span className="text-[0.55rem] text-[var(--color-text-muted)] ml-auto">{q.progress}/{q.requirement}</span>
                                </div>
                                <p className="text-[0.55rem] text-[var(--color-text-muted)] leading-tight">{q.description}</p>
                                <div className="h-1 bg-[var(--color-bg-hover)] rounded-full overflow-hidden mt-0.5">
                                    <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all" style={{width:`${pct}%`}}/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
