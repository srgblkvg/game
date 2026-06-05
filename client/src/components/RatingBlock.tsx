import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { fetchRating } from '../api/character';

export default function RatingBlock() {
    const [players, setPlayers] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRating(1, 5).then(data => setPlayers(data.users)).catch(console.error);
    }, []);

    const trophy = <Icon icon="game-icons:trophy" width="18" height="18" />;

    if (players.length === 0) return (
        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl p-4 min-w-[190px] overflow-hidden">
            <h3 className="text-[var(--color-text-accent)] text-base font-bold mb-2 cursor-pointer flex items-center gap-1" onClick={() => navigate('/rating')}>
                {trophy} Рейтинг
            </h3>
            <p className="text-[var(--color-text-muted)] text-sm">Пока пусто</p>
        </div>
    );

    const maxNickLength = 10;
    const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

    return (
        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl p-4 min-w-[190px] overflow-hidden">
            <h3
                className="text-[var(--color-text-accent)] text-base font-bold mb-2 cursor-pointer flex items-center gap-1"
                onClick={() => navigate('/rating')}
            >
                {trophy} Рейтинг
            </h3>
            <ul className="list-none p-0 m-0">
                {players.map((p, i) => (
                    <li key={p.id} className="flex py-1 border-b border-[var(--color-border-light)] text-sm">
                        <span
                            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${p.id}`); }}
                            className="cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] transition-colors flex-1"
                        >
                            {i + 1}. {truncate(p.username)}
                        </span>
                        <span className="text-xs text-center w-1/4" style={{ color: p.rank?.color }}>
                            {p.rank ? `${p.rank.icon} ${p.rank.name}` : '—'}
                        </span>
                        <span className="font-bold text-xs w-1/4 text-right" style={{ color: p.rank?.color }}>{p.elo}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
