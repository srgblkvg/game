import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchRating } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

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
        <div className="max-w-xl mx-auto px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2"/>Рейтинг Скорби</h2>

            <Card>
                {players.length === 0 ? (
                    <p className="text-[var(--color-text-muted)]">Нет игроков</p>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1.5 text-sm">Игрок</th>
                                <th className="text-right p-1.5 text-sm">ELO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((p, i) => (
                                <tr key={p.id} className="border-b border-[var(--color-border-light)]">
                                    <td className="p-1.5">
                                        <span
                                            onClick={() => navigate(`/profile/${p.id}`)}
                                            className="cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] transition-colors"
                                        >
                                            {i + 1 + (page - 1) * LIMIT}. {truncate(p.username)}{' '}
                                            <span style={{ color: p.rank?.color }}>({p.rank?.icon} {p.rank?.name})</span>
                                        </span>
                                    </td>
                                    <td className="text-right p-1.5 font-bold" style={{ color: p.rank?.color }}>
                                        {p.elo}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-center gap-4 mt-4 items-center">
                        <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</Button>
                        <span className="text-sm text-[var(--color-text-secondary)]">стр. {page} из {totalPages}</span>
                        <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Вперёд →</Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
