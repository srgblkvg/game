import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

    useEffect(() => { if (!user) navigate('/login');
        fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() })
            .then(r => r.json()).then(setGuilds).catch(() => {});
    }, [user]);

    const myGuildId = (character as any)?.guildId;

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Рейтинг гильдий</h1>
            {guilds.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет гильдий</p>
            ) : (
                guilds.map((g: any, i) => {
                    const isMyGuild = myGuildId && g.id === myGuildId;
                    const rank = i + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                    return (
                    <Card key={g.id} className={`mb-2 ${isMyGuild ? 'border-[var(--color-accent-success)] bg-[var(--color-accent-success)]/10' : ''}`}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-start gap-2 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/guild/${g.id}`)}>
                                <span className="text-sm font-bold w-8 text-center shrink-0">{medal}</span>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-sm hover:text-[var(--color-accent-info)] transition-colors">🏚️ {g.name}</h4>
                                    <div className="text-xs text-[var(--color-text-muted)] space-y-0.5 mt-0.5">
                                        <p>Уровень: {g.level}</p>
                                        <p>Участники: {g.memberCount}</p>
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
                                        {g.warStatus && (
                                            <p className="text-[var(--color-war-active-text)]">
                                                ⚔️ {g.warStatus === 'active' ? 'Воюет с' : 'Ожидает ответа от'} «{g.warOpponent}»
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {isMyGuild && (
                                <span className="text-[0.6rem] text-[var(--color-accent-success)] font-bold px-2 py-0.5 rounded border border-[var(--color-accent-success)] shrink-0 ml-2">Ваша гильдия</span>
                            )}
                        </div>
                    </Card>
                    );
                })
            )}
        </div>
    );
}
