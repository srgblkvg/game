import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRating } from '../api/character';

const LIMIT = 20;

export default function RatingPage() {
    const [players, setPlayers] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRating(page, LIMIT).then(data => {
            setPlayers(data.users);
            setTotalPages(Math.ceil(data.total / LIMIT));
        }).catch(console.error);
    }, [page]);

    const maxNickLength = 12;
    const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

    return (
        <div style={{ padding: '1rem', color: '#eee', maxWidth: '600px', margin: '0 auto' }}>
            <button onClick={() => navigate('/')} style={{ background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem' }}>← Назад</button>
            <h2>🏆 Рейтинг игроков</h2>

            <div style={{ background: '#1e1e30', borderRadius: '8px', padding: '1rem' }}>
                {players.length === 0 ? (
                    <div>Нет игроков</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #444' }}>
                                <th style={{ textAlign: 'left', padding: '0.3rem' }}>Игрок</th>
                                <th style={{ textAlign: 'right', padding: '0.3rem' }}>Побед</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((p, i) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #333' }}>
                                    <td style={{ padding: '0.3rem' }}>
                                        <span
                                            onClick={() => navigate(`/profile/${p.id}`)}
                                            style={{
                                                cursor: 'pointer',
                                                color: '#eee',
                                                transition: 'color 0.2s',
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.color = '#3498db')}
                                            onMouseLeave={(e) => (e.currentTarget.style.color = '#eee')}
                                        >
                                            {i + 1 + (page - 1) * LIMIT}. {truncate(p.username)} <span style={{ color: '#888' }}>[{p.level}]</span>
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '0.3rem', color: '#2ecc71', fontWeight: 'bold' }}>{p.wins}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            style={{ background: '#555', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'not-allowed' }}
                        >
                            ← Назад
                        </button>
                        <span>стр. {page} из {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                            style={{ background: '#555', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'not-allowed' }}
                        >
                            Вперёд →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}