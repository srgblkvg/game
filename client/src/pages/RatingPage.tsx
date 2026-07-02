import { Icon } from "@iconify/react";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { fetchRating } from '../api/character';
import { useAuth } from '../contexts/AuthContext';
import { getHeaders, BASE_URL } from '../api/helpers';
import Card from '../components/ui/Card';
import GuildTag from '../components/GuildTag';
import Button from '../components/ui/Button';

const LIMIT = 20;

export default function RatingPage() {
    const { user } = useAuth();
    const [players, setPlayers] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showInfo, setShowInfo] = useState(false);
    const [initialPageSet, setInitialPageSet] = useState(false);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [minElo, setMinElo] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const navigate = useNavigate();

    // Живой поиск с задержкой 300мс
    const prevSearchRef = useRef(searchInput);
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearch(searchInput);
            if (searchInput !== prevSearchRef.current) {
                setPage(1);
                prevSearchRef.current = searchInput;
            }
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchInput]);

    // Звания для фильтра
    const rankFilters = [
        { label: 'Все звания', min: 0 },
        { label: '👑 Смерть (2100+)', min: 2100 },
        { label: '♦♦♦ Вечность (1900+)', min: 1900 },
        { label: '♦♦ Бездна (1700+)', min: 1700 },
        { label: '♦ Погибель (1500+)', min: 1500 },
        { label: '▪▪▪ Кошмар (1300+)', min: 1300 },
        { label: '▪▪ Кровь (1100+)', min: 1100 },
        { label: '▪ Тень (900+)', min: 900 },
        { label: '••• Шёпот (600+)', min: 600 },
        { label: '•• Кость (300+)', min: 300 },
        { label: '• Пепел (0+)', min: 0 },
    ];

    // Найти страницу с текущим игроком
    useEffect(() => {
        if (!user || initialPageSet) return;
        fetch(`${BASE_URL}/my-position`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                if (data.position) {
                    const myPage = Math.ceil(data.position / LIMIT);
                    setPage(myPage);
                }
                setInitialPageSet(true);
            })
            .catch(() => setInitialPageSet(true));
    }, [user]);

    useEffect(() => {
        if (!initialPageSet) return;
        fetchRating(page, LIMIT, search, minElo).then(data => {
            setPlayers(data.users);
            setTotalPages(Math.ceil(data.total / LIMIT));
        }).catch(console.error);
    }, [page, initialPageSet, search, minElo]);

    return (
        <div className="max-w-xl mx-auto px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2"/>Рейтинг игроков</h2>

            {/* Поиск + фильтр */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    placeholder="Поиск по нику..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-sm"
                />
                {searchInput && (
                    <Button size="sm" variant="danger" onClick={() => { setSearchInput(''); setSearch(''); }}>
                        ✕
                    </Button>
                )}
            </div>
            <div className="mb-4">
                <select
                    value={minElo}
                    onChange={e => { setMinElo(parseInt(e.target.value)); setPage(1); }}
                    className="w-full px-3 py-1.5 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-sm"
                >
                    {rankFilters.map(r => (
                        <option key={r.min} value={r.min}>{r.label}</option>
                    ))}
                </select>
            </div>

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
                                <li>Поражение от слабого: <span className="text-[var(--color-accent-danger)]">до −34</span></li>
                                <li>Поражение от сильного: <span className="text-[var(--color-accent-danger)]">−6</span></li>
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
                                <li>7+ дней без боёв: <span className="text-[var(--color-accent-danger)]">−5 в день</span></li>
                                <li>14+ дней: <span className="text-[var(--color-accent-danger)]">−10 в день</span></li>
                                <li>30+ дней: <span className="text-[var(--color-accent-danger)]">−20 в день</span></li>
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
                                <th className="text-left p-1.5 text-sm" style={{ width: '36%' }}>Ник</th>
                                <th className="text-left p-1.5 text-sm hidden sm:table-cell" style={{ width: '36%' }}>Гильдия</th>
                                <th className="text-center p-1.5 text-sm" style={{ width: '19%' }}>Титул</th>
                                <th className="text-right p-1.5 text-sm" style={{ width: '9%' }}>Очки</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((p, i) => {
                                const isMe = user && p.id === user.id;
                                return (
                                <tr key={p.id} className={`border-b border-[var(--color-border-light)] ${isMe ? 'bg-[var(--color-bg-hover)] border-l-2 border-[var(--color-accent-success)]' : ''}`}>
                                    <td className="p-1.5">
                                        <span
                                            onClick={() => navigate(`/profile/${p.id}`)}
                                            className={`cursor-pointer hover:text-[var(--color-accent-info)] transition-colors block truncate ${isMe ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-text-primary)]'}`}
                                        >
                                            {i + 1 + (page - 1) * LIMIT}. {p.username} {isMe ? '(Вы)' : ''}
                                        </span>
                                        <span className="sm:hidden"><GuildTag guildName={p.guildName} guildId={p.guildId} /></span>
                                    </td>
                                    <td className="p-1.5 hidden sm:table-cell">
                                        <GuildTag guildName={p.guildName} guildId={p.guildId} />
                                    </td>
                                    <td className="p-1.5 text-center" style={{ color: p.rank?.color }}>
                                        <span className="sm:hidden">{p.rank?.icon}</span>
                                        <span className="hidden sm:inline">{p.rank ? `${p.rank.icon} ${p.rank.name}` : '—'}</span>
                                    </td>
                                    <td className="text-right p-1.5 font-bold" style={{ color: p.rank?.color }}>
                                        {p.elo}
                                    </td>
                                </tr>
                                );
                            })}
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
