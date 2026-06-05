import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRating } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const LIMIT = 20;

export default function RatingPage() {
    const [players, setPlayers] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showInfo, setShowInfo] = useState(false);
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
            <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2"/>Рейтинг</h2>

            {/* Инструкция */}
            <Card className="mb-4">
                <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowInfo(!showInfo)}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{showInfo ? '▼' : '▶'}</span>
                        <h3 className="font-bold text-sm">Как зарабатывается рейтинг</h3>
                    </div>
                </div>
                {showInfo && (
                    <div className="mt-3 text-xs text-[var(--color-text-muted)] space-y-3">
                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)] mb-1">⚔️ Бои с игроками (PvP)</h4>
                            <p>Основной источник рейтинга. Побеждая сильных противников, вы получаете больше очков. Победа над слабым игроком почти ничего не даёт.</p>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Победа над равным: <span className="text-[var(--color-accent-success)]">+20</span></li>
                                <li>Победа над более сильным: <span className="text-[var(--color-accent-success)]">до +34</span></li>
                                <li>Поражение от слабого: <span className="text-red-500">до −34</span></li>
                                <li>Поражение от сильного: <span className="text-red-500">−6</span></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)] mb-1">💀 Охота на монстров (PvE)</h4>
                            <p>Небольшая прибавка к рейтингу за убийство монстров. Не более 15% от общего рейтинга можно получить этим способом.</p>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Моб равного уровня: <span className="text-[var(--color-accent-success)]">+1</span> (раз в час)</li>
                                <li>Моб сильнее вас: <span className="text-[var(--color-accent-success)]">+2</span> (раз в час)</li>
                                <li>Босс (уровень 100+): <span className="text-[var(--color-accent-success)]">+10</span> (раз в сутки)</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)] mb-1">🔨 Заточка предметов</h4>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>Улучшение до +7: <span className="text-[var(--color-accent-success)]">+5</span></li>
                                <li>Улучшение до +10: <span className="text-[var(--color-accent-success)]">+50</span></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)] mb-1">📉 Затухание рейтинга</h4>
                            <p>Если вы не участвуете в PvP-боях, рейтинг начинает падать:</p>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                <li>7+ дней без боёв: <span className="text-red-500">−5 в день</span></li>
                                <li>14+ дней: <span className="text-red-500">−10 в день</span></li>
                                <li>30+ дней: <span className="text-red-500">−20 в день</span></li>
                            </ul>
                            <p className="mt-1">Минимальный рейтинг: 100 очков.</p>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)] mb-1">🏆 Звания</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                                <div><span style={{color:'#6b6b6b'}}>• Пепел</span> — 100</div>
                                <div><span style={{color:'#a09080'}}>•• Кость</span> — 300</div>
                                <div><span style={{color:'#6b8b6b'}}>••• Шёпот</span> — 600</div>
                                <div><span style={{color:'#5a5a8b'}}>▪ Тень</span> — 900</div>
                                <div><span style={{color:'#8b3030'}}>▪▪ Кровь</span> — 1100</div>
                                <div><span style={{color:'#7b208b'}}>▪▪▪ Кошмар</span> — 1300</div>
                                <div><span style={{color:'#c08020'}}>♦ Погибель</span> — 1500</div>
                                <div><span style={{color:'#c02020'}}>♦♦ Бездна</span> — 1700</div>
                                <div><span style={{color:'#20c0c0'}}>♦♦♦ Вечность</span> — 1900</div>
                                <div><span style={{color:'#ff4040'}}>👑 Смерть</span> — 2100</div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--color-text-primary)] mb-1">🔄 Сезоны</h4>
                            <p>Каждый месяц рейтинг частично сбрасывается. Новый рейтинг = 1000 + (старый − 1000) / 2. Топ-10 игроков попадают в Зал Славы.</p>
                        </div>
                    </div>
                )}
            </Card>

            <Card>
                {players.length === 0 ? (
                    <p className="text-[var(--color-text-muted)]">Нет игроков</p>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1.5 text-sm w-2/4">Ник</th>
                                <th className="text-center p-1.5 text-sm w-1/4">Титул</th>
                                <th className="text-right p-1.5 text-sm w-1/4">Очки</th>
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
                                            {i + 1 + (page - 1) * LIMIT}. {truncate(p.username)}
                                        </span>
                                    </td>
                                    <td className="p-1.5 text-center" style={{ color: p.rank?.color }}>
                                        {p.rank ? `${p.rank.icon} ${p.rank.name}` : '—'}
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
