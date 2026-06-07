import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';
import { inputClass } from '../utils/formStyles';

const divisionColors: Record<string, string> = {
    copper: '#b8703a', steel: '#909090', mithril: '#40b0d0', adamant: '#e03030',
};

const divisionIcons: Record<string, string> = {
    copper: '🥉', steel: '🥈', mithril: '🥇', adamant: '👑',
};

const divisionLabels: Record<string, string> = {
    copper: 'Медный', steel: 'Стальной', mithril: 'Мифриловый', adamant: 'Адамантовый',
};

const statusLabels: Record<string, string> = {
    registration: 'Регистрация', in_progress: 'Идёт', completed: 'Завершён', cancelled: 'Отменён',
};

const statusColors: Record<string, string> = {
    registration: 'var(--color-accent-success)', in_progress: 'var(--color-accent-danger)',
    completed: 'var(--color-text-muted)', cancelled: 'var(--color-text-muted)',
};

function tournamentLabel(t: any): string {
    if (t.type === 'custom') return t.name || 'Турнир';
    return divisionLabels[t.division] || t.division;
}

function tournamentIcon(t: any): string {
    if (t.type === 'custom') return '🎪';
    return divisionIcons[t.division] || '🏆';
}

function canJoinOfficial(t: any, userLevel: number): boolean {
    const levels: Record<string, [number, number]> = { copper: [1, 15], steel: [16, 35], mithril: [36, 60], adamant: [61, 999] };
    const [min, max] = levels[t.division] || [0, 0];
    return userLevel >= min && userLevel <= max;
}

function formatTimer(seconds: number): string {
    if (seconds <= 0) return '0 мин';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(d + ' дн');
    if (h > 0) parts.push(h + ' ч');
    if (m > 0) parts.push(m + ' мин');
    return parts.join(' ') || '0 мин';
}

export default function TournamentPage() {
    const { user } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [tab, setTab] = useState<'all' | 'official' | 'custom' | 'completed'>('all');
    const [data, setData] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [expandedLog, setExpandedLog] = useState<number | null>(null);
    const [completedPage, setCompletedPage] = useState(1);

    // Форма создания custom турнира
    const [showCreate, setShowCreate] = useState(false);
    const [cf, setCf] = useState({ name: '', prizePool: 500, entryFee: 0, registrationMinutes: 30, maxPlayers: 8, minLevel: 1, maxLevel: 999 });

    useEffect(() => { if (!user) navigate('/login'); else if (!user.isGuest) load(); }, [user, tab, completedPage]);

    const isGuest = user?.isGuest || false;

    const load = async () => {
        try {
            let url: string;
            if (tab === 'completed') {
                url = `${BASE_URL}/tournament?tab=completed&page=${completedPage}`;
            } else if (tab === 'all') {
                url = `${BASE_URL}/tournament?tab=active`;
            } else {
                url = `${BASE_URL}/tournament?tab=active&type=${tab}`;
            }
            const res = await fetch(url, { headers: getHeaders() });
            setData(await res.json());
        } catch (e: any) { setError(e.message); }
    };

    const handleRegister = async (tournamentId: number, division?: string) => {
        try {
            const body: any = division ? { division } : { tournamentId };
            const res = await fetch(`${BASE_URL}/tournament/register`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(body),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error); return; }
            setMessage('Зарегистрирован!');
            const fresh = await fetchCharacter(); setCharacter(fresh);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleCreateCustom = async () => {
        try {
            const res = await fetch(`${BASE_URL}/tournament/create-custom`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify(cf),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error); return; }
            setMessage('Турнир создан!');
            setShowCreate(false);
            setTab('custom');
            load();
        } catch (e: any) { setError(e.message); }
    };

    if (!data) return <div className="p-4">Загрузка...</div>;

    if (isGuest) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-4">
                <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2" />Турнир «Кровавый Шпиль»</h1>
                <Card className="text-center py-6">
                    <Icon icon="game-icons:lock" width="40" height="40" className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Турниры недоступны на гостевом аккаунте.</p>
                </Card>
            </div>
        );
    }

    const renderActiveCard = (t: any) => {
        const myReg = t.myRegistration;
        const joinable = t.type === 'official' ? canJoinOfficial(t, data.userLevel) :
            data.userLevel >= (t.minLevel || 1) && data.userLevel <= (t.maxLevel || 999);

        const matchesByRound: Record<number, any[]> = {};
        if (t.matches) {
            for (const m of t.matches) {
                if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
                matchesByRound[m.round].push(m);
            }
        }
        const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

        return (
            <Card key={t.id} className="mb-3" style={{ borderColor: joinable ? (t.type === 'custom' ? '#a0a0ff' : divisionColors[t.division]) : undefined }}>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm" style={{ color: t.type === 'custom' ? '#a0a0ff' : divisionColors[t.division] }}>
                        {tournamentIcon(t)} {tournamentLabel(t)}
                        {t.type === 'official' && <span className="text-xs text-[var(--color-text-muted)] ml-1">(офиц.)</span>}
                        {t.type === 'custom' && <span className="text-xs text-[var(--color-accent-purple)] ml-1">(игрок)</span>}
                    </h3>
                    <div className="text-right">
                        <span className="text-xs font-medium" style={{ color: statusColors[t.status] }}>{statusLabels[t.status]}</span>
                        {t.status === 'registration' && (
                            <p className="text-[0.65rem] text-[var(--color-accent-info)]">
                                до старта: {formatTimer(Math.max(0, t.registrationEnd - Math.floor(Date.now() / 1000)))}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mb-2 space-y-0.5">
                    <p>Призовой фонд: {formatMoney(t.prizePool)}</p>
                    {t.entryFee > 0 && <p>Стоимость входа: {formatMoney(t.entryFee)}</p>}
                    <p>Участников: {t.participantCount}/{t.maxPlayers || 8}</p>
                    {t.minLevel && t.maxLevel && <p>Уровни: {t.minLevel}–{t.maxLevel}</p>}
                    {t.participants.slice(0, 5).map((p: any) => (
                        <span key={p.id} className="mr-2">{p.username}{p.goldenTicket ? ' 🎫' : ''}{p.snapshotStats?.place === 1 ? ' 🏆' : p.snapshotStats?.place === 2 ? ' 2-е' : p.snapshotStats?.place === 3 ? ' 3-е' : ''}</span>
                    ))}
                    {t.participantCount > 5 && <span>+ ещё {t.participantCount - 5}</span>}
                </div>

                {t.status === 'registration' && joinable && !myReg && (
                    <div className="flex gap-2">
                        <Button variant="danger" size="xs" onClick={() => handleRegister(t.id, t.type === 'official' ? t.division : undefined)}>
                            {t.type === 'custom' && t.entryFee > 0 ? `Вступить (${formatMoney(t.entryFee)})` : 'Записаться'}
                        </Button>
                        {t.type === 'official' && (
                            <Button variant="secondary" size="xs" onClick={() => handleRegister(t.id, t.division + '🎫')}>🎫 Золотой билет (1000)</Button>
                        )}
                    </div>
                )}
                {myReg && (
                    <p className="text-xs text-[var(--color-accent-success)]">
                        ✅ Вы записаны {myReg.goldenTicket ? '🎫' : ''}
                        {myReg.snapshotStats?.place && ` — ${myReg.snapshotStats.place}-е место, приз: ${formatMoney(myReg.snapshotStats.prize || 0)}`}
                    </p>
                )}

                {rounds.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Турнирная сетка</h4>
                        {rounds.map(round => {
                            const roundMatches = matchesByRound[round];
                            const totalRounds = rounds.length;
                            const roundLabel = round === totalRounds ? '🏆 Финал' : round === totalRounds - 1 ? 'Полуфинал' : `Раунд ${round}`;
                            return (
                                <div key={round}>
                                    <p className="text-[0.6rem] font-bold text-[var(--color-text-muted)] uppercase mb-1">{roundLabel}</p>
                                    <div className="space-y-1">
                                        {roundMatches.map((m: any) => (
                                            <div key={m.id}>
                                                <div className={`text-xs flex items-center gap-1 py-0.5 px-2 rounded ${m.winnerId ? 'bg-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-card)]'}`}>
                                                    <span className={m.winnerId === m.player1Id ? 'font-bold text-[var(--color-accent-success)]' : ''}>{m.player1Name || '—'}</span>
                                                    <span className="text-[var(--color-text-muted)]">vs</span>
                                                    <span className={m.winnerId === m.player2Id ? 'font-bold text-[var(--color-accent-success)]' : ''}>{m.player2Name || '—'}</span>
                                                    {m.winnerId && (
                                                        <span className="ml-auto text-[0.6rem] text-[var(--color-accent-info)] cursor-pointer hover:underline" onClick={() => setExpandedLog(expandedLog === m.id ? null : m.id)}>
                                                            {expandedLog === m.id ? 'Скрыть' : 'Бой'}
                                                        </span>
                                                    )}
                                                </div>
                                                {expandedLog === m.id && m.log && (
                                                    <div className="mt-1 p-2 bg-black/40 rounded text-[0.6rem] text-[var(--color-text-muted)] max-h-48 overflow-y-auto font-mono leading-relaxed">
                                                        {m.log.map((step: any, i: number) => (
                                                            <div key={i} className={step.type === 'end' ? 'text-[var(--color-accent-success)] font-bold' : step.type === 'crit' ? 'text-yellow-400' : step.type === 'damage' ? 'text-red-400' : step.type === 'block' ? 'text-blue-400' : step.type === 'fullBlock' ? 'text-cyan-400 font-bold' : step.type === 'dodge' ? 'text-purple-400' : step.type === 'stun' ? 'text-orange-400' : step.type === 'counter' ? 'text-pink-400' : step.type === 'money' ? 'text-yellow-300' : ''}>
                                                                {step.message}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        );
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-2"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2" />Турнир «Кровавый Шпиль»</h1>
            <p className="text-xs text-[var(--color-text-muted)] italic mb-3">«Ворота Арены открыты. Выходит только сильнейший.»</p>

            <div className="flex gap-2 mb-4 flex-wrap">
                <Button variant={tab === 'all' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('all'); setCompletedPage(1); }}>Все</Button>
                <Button variant={tab === 'official' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('official'); setCompletedPage(1); }}>Официальные</Button>
                <Button variant={tab === 'custom' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('custom'); setCompletedPage(1); }}>Самоорганизованные</Button>
                <Button variant={tab === 'completed' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('completed'); setCompletedPage(1); }}>Завершённые</Button>
            </div>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            {/* Кнопка создания custom турнира */}
            {tab === 'custom' && !showCreate && (
                <Button variant="danger" size="sm" className="mb-3" onClick={() => setShowCreate(true)}>
                    + Создать турнир
                </Button>
            )}

            {/* Форма создания */}
            {showCreate && (
                <Card className="mb-4">
                    <h3 className="font-bold mb-2 text-sm">Создать турнир</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <label className="text-[var(--color-text-muted)]">Название</label>
                            <input className={inputClass} value={cf.name} onChange={e => setCf({ ...cf, name: e.target.value })} placeholder="Мой турнир" />
                        </div>
                        <div>
                            <label className="text-[var(--color-text-muted)]">Призовой фонд</label>
                            <input className={inputClass} type="number" value={cf.prizePool} onChange={e => setCf({ ...cf, prizePool: Number(e.target.value) })} min={0} />
                        </div>
                        <div>
                            <label className="text-[var(--color-text-muted)]">Входной взнос</label>
                            <input className={inputClass} type="number" value={cf.entryFee} onChange={e => setCf({ ...cf, entryFee: Number(e.target.value) })} min={0} />
                        </div>
                        <div>
                            <label className="text-[var(--color-text-muted)]">Время на сбор (мин)</label>
                            <input className={inputClass} type="number" value={cf.registrationMinutes} onChange={e => setCf({ ...cf, registrationMinutes: Number(e.target.value) })} min={5} max={120} />
                        </div>
                        <div>
                            <label className="text-[var(--color-text-muted)]">Макс. игроков</label>
                            <input className={inputClass} type="number" value={cf.maxPlayers} onChange={e => setCf({ ...cf, maxPlayers: Number(e.target.value) })} min={2} max={16} />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[var(--color-text-muted)]">Мин. уровень</label>
                                <input className={inputClass} type="number" value={cf.minLevel} onChange={e => setCf({ ...cf, minLevel: Number(e.target.value) })} min={1} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[var(--color-text-muted)]">Макс. уровень</label>
                                <input className={inputClass} type="number" value={cf.maxLevel} onChange={e => setCf({ ...cf, maxLevel: Number(e.target.value) })} min={1} />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <Button variant="danger" size="sm" onClick={handleCreateCustom}>Создать</Button>
                        <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Отмена</Button>
                    </div>
                </Card>
            )}

            {/* Активные / Официальные / Самоорганизованные */}
            {(tab === 'all' || tab === 'official' || tab === 'custom') && data.tournaments.map(renderActiveCard)}

            {['all', 'official', 'custom'].includes(tab) && data.tournaments.length === 0 && (
                <Card className="text-center py-6"><p className="text-sm text-[var(--color-text-muted)]">Нет турниров</p></Card>
            )}

            {/* Завершённые */}
            {tab === 'completed' && (
                <>
                    {data.tournaments.map((t: any) => (
                        <Card key={t.id} className="mb-3">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-sm" style={{ color: divisionColors[t.division] || '#a0a0ff' }}>
                                    {tournamentIcon(t)} {tournamentLabel(t)}
                                    {t.type === 'custom' && <span className="text-xs text-[var(--color-accent-purple)] ml-1">игрок</span>}
                                </h3>
                                <span className="text-xs text-[var(--color-text-muted)]">{new Date(t.createdAt * 1000).toLocaleDateString('ru-RU')}</span>
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] mb-1">
                                <span>Участников: {t.participantCount}</span>
                                <span className="ml-2">Призовой фонд: {formatMoney(t.prizePool)}</span>
                            </div>
                            {t.top3 && t.top3.length > 0 && (
                                <div className="text-xs">
                                    {t.top3.map((p: any) => (
                                        <span key={p.username + p.place} className="mr-3">
                                            {p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : '🥉'} {p.username} — {formatMoney(p.prize)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Card>
                    ))}
                    {data.totalPages > 1 && (
                        <div className="flex justify-center gap-4 mt-4 items-center">
                            <Button size="sm" disabled={data.page <= 1} onClick={() => setCompletedPage(data.page - 1)}>← Назад</Button>
                            <span className="text-sm text-[var(--color-text-secondary)]">стр. {data.page} из {data.totalPages}</span>
                            <Button size="sm" disabled={data.page >= data.totalPages} onClick={() => setCompletedPage(data.page + 1)}>Вперёд →</Button>
                        </div>
                    )}
                    {data.tournaments.length === 0 && <Card className="text-center py-6"><p className="text-sm text-[var(--color-text-muted)]">Нет завершённых турниров</p></Card>}
                </>
            )}
        </div>
    );
}
