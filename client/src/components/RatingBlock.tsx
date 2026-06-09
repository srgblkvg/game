import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { fetchRating } from '../api/character';
import { getHeaders, BASE_URL } from '../api/helpers';
import GuildTag from './GuildTag';

export default function RatingBlock() {
    const [players, setPlayers] = useState<any[]>([]);
    const [guilds, setGuilds] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRating(1, 5).then(data => setPlayers(data.users)).catch(console.error);
    }, []);

    useEffect(() => {
        fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() })
            .then(res => res.json())
            .then(data => setGuilds((data || []).slice(0, 5)))
            .catch(console.error);
    }, []);

    const trophy = <Icon icon="game-icons:trophy" width="18" height="18" />;
    const castle = <Icon icon="game-icons:castle" width="18" height="18" />;

    return (
        <div className="flex flex-col gap-4">
            {/* Рейтинг гильдий */}
            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
                <h3
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-accent-success)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap"
                    onClick={() => navigate('/guild/rating')}
                >
                    {castle} Рейтинг гильдий
                </h3>
                {guilds.length === 0 ? (
                    <p className="text-[var(--color-text-muted)] text-sm">Пока пусто</p>
                ) : (
                    <ul className="list-none p-0 m-0">
                        {guilds.map((g, i) => (
                            <li key={g.id} className="flex py-1 border-b border-[var(--color-border-light)] text-sm">
                                <span
                                    onClick={() => navigate(`/guild/${g.id}`)}
                                    className="cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] transition-colors flex-1 truncate"
                                >
                                    {i + 1}. {g.name}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                    Ур.{g.level} · {g.memberCount} уч.
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Рейтинг игроков */}
            {players.length === 0 ? (
                <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
                    <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-text-accent)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap" onClick={() => navigate('/rating')}>
                        {trophy} Рейтинг игроков
                    </h3>
                    <p className="text-[var(--color-text-muted)] text-sm">Пока пусто</p>
                </div>
            ) : (
                <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
                    <h3
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-text-accent)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap"
                        onClick={() => navigate('/rating')}
                    >
                        {trophy} Рейтинг игроков
                    </h3>
                    <ul className="list-none p-0 m-0">
                        {players.map((p, i) => (
                            <li key={p.id} className="flex py-1 border-b border-[var(--color-border-light)] text-sm items-center">
                                <span
                                    onClick={(e) => { e.stopPropagation(); navigate(`/profile/${p.id}`); }}
                                    className="cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] transition-colors truncate w-[36.364%]"
                                >
                                    {i + 1}. {p.username}
                                </span>
                                <span className="w-[36.364%]">
                                    <GuildTag guildName={p.guildName} guildId={p.guildId} />
                                </span>
                                <span className="text-xs text-center truncate w-[18.182%]" style={{ color: p.rank?.color }}>
                                    {p.rank ? `${p.rank.icon} ${p.rank.name}` : '—'}
                                </span>
                                <span className="font-bold text-xs text-right w-[9.091%]" style={{ color: p.rank?.color }}>{p.elo}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
