import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import Card from '../components/ui/Card';

export default function GuildRatingPage() {
    const { user } = useAuth();
    const { character } = useGame();
    const navigate = useNavigate();
    const [guilds, setGuilds] = useState<any[]>([]);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    useEffect(() => { if (!user) navigate('/login');
        fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() })
            .then(r => r.json()).then(setGuilds).catch(() => {});
    }, [user]);

    const myGuildId = (character as any)?.guildId;

    const toggle = (id: number) => {
        setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Рейтинг гильдий</h1>
            {guilds.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет гильдий</p>
            ) : (
                guilds.map((g: any, i) => {
                    const isMyGuild = myGuildId && g.id === myGuildId;
                    const rank = i + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                    const isExpanded = expanded.has(g.id);
                    return (
                    <Card key={g.id} className={`mb-2 ${isMyGuild ? 'border-[var(--color-accent-success)] bg-[var(--color-accent-success)]/10' : ''}`}>
                        <div
                            className="flex justify-between items-start cursor-pointer select-none"
                            onClick={() => toggle(g.id)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
                                <span className="text-sm font-bold w-8 text-center">{medal}</span>
                                <h4 className="font-bold text-sm">{g.name}</h4>
                                {g.warStatus && (
                                    <span className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold"
                                        style={{
                                            color: g.warStatus === 'active' ? 'var(--color-war-active-text)' : 'var(--color-war-pending-text)',
                                            backgroundColor: g.warStatus === 'active' ? 'var(--color-war-active-bg)' : 'var(--color-war-pending-bg)',
                                        }}>
                                        ⚔️
                                    </span>
                                )}
                                {isMyGuild && (
                                    <span className="text-[0.6rem] text-[var(--color-accent-success)] font-bold px-1.5 py-0.5 rounded border border-[var(--color-accent-success)]">Ваша</span>
                                )}
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-3 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/guild/${g.id}`)}>
                                        {(g.image || g.description) ? (
                                            <div className="flex-shrink-0 border-2 border-[var(--color-accent-gold)] rounded-lg p-2 bg-[var(--color-bg-card)]" style={{ minWidth: 80, maxWidth: 120 }}>
                                                {g.image && <img src={g.image} alt="Герб" className="w-full h-auto object-contain rounded mb-1" />}
                                                {g.description && <p className="text-[0.6rem] text-[var(--color-text-secondary)] italic text-center leading-tight">{'«'}{g.description}{'»'}</p>}
                                            </div>
                                        ) : null}
                                        <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
                                            <p>Уровень: {g.level}</p>
                                            <p>Участники: {g.memberCount}/20</p>
                                            <p>Казна: {(g.treasury || 0).toLocaleString()} серебра</p>
                                            <p>
                                                Лидер:{' '}
                                                <span
                                                    className="text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/profile/${g.leaderUserId}`); }}
                                                >
                                                    👑 {g.leaderName}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {g.warStatus && (
                                    <div className="mt-1.5 text-xs rounded p-1.5"
                                        style={{
                                            color: 'var(--color-war-active-text)',
                                            backgroundColor: 'var(--color-war-active-bg)',
                                        }}>
                                        ⚔️ {g.warStatus === 'active' ? 'Воюет с' : 'Ожидает ответа от'} «{g.warOpponent}»
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                    );
                })
            )}
        </div>
    );
}
