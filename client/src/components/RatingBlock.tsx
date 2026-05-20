import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRating } from '../api/character';

export default function RatingBlock() {
    const [players, setPlayers] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRating(1, 10).then(data => setPlayers(data.users)).catch(console.error);
    }, []);

    if (players.length === 0) return null;

    const maxNickLength = 12;
    const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

    return (
        <div style={{
            background: '#1e1e30',
            border: '2px solid #555',
            borderRadius: '12px',
            padding: '1rem',
            color: '#eee',
            minWidth: 0,
            overflow: 'hidden',
        }}>
            <h3
                style={{ margin: '0 0 0.5rem 0', cursor: 'pointer', color: '#f1c40f', fontSize: '1.1rem' }}
                onClick={() => navigate('/rating')}
            >
                🏆 Рейтинг
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {players.map((p, i) => (
                    <li key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '0.2rem 0', borderBottom: '1px solid #333',
                        fontSize: '0.85rem',
                    }}>
                        <span
                            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${p.id}`); }}
                            style={{
                                cursor: 'pointer',
                                color: '#eee',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#3498db')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#eee')}
                        >
                            {i + 1}. {truncate(p.username)} <span style={{ color: '#888' }}>[{p.level}]</span>
                        </span>
                        <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>{p.wins}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}