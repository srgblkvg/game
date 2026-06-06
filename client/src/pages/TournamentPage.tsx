import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

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
    registration: 'Регистрация',
    in_progress: 'Идёт',
    completed: 'Завершён',
    cancelled: 'Отменён',
};

const statusColors: Record<string, string> = {
    registration: 'var(--color-accent-success)',
    in_progress: 'var(--color-accent-danger)',
    completed: 'var(--color-text-muted)',
    cancelled: 'var(--color-text-muted)',
};

export default function TournamentPage() {
    const { user } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [data, setData] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [expandedLog, setExpandedLog] = useState<number | null>(null);

    useEffect(() => { if (!user) navigate('/login'); else if (!user.isGuest) load(); }, [user]);

    const isGuest = user?.isGuest || false;

    const load = async () => {
        try {
            const res = await fetch(`${BASE_URL}/tournament`, { headers: getHeaders() });
            setData(await res.json());
        } catch (e: any) { setError(e.message); }
    };

    const handleRegister = async (division: string, golden?: boolean) => {
        try {
            const res = await fetch(`${BASE_URL}/tournament/register`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ division, goldenTicket: golden || false }),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error); return; }
            setMessage('Зарегистрирован!');
            const fresh = await fetchCharacter(); setCharacter(fresh);
            load();
        } catch (e: any) { setError(e.message); }
    };

    if (!data) return <div className="p-4">Загрузка...</div>;

    if (isGuest) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-4">
                <BackButton to="/" />
                <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2" />Турнир «Кровавый Шпиль»</h1>
                <Card className="text-center py-6">
                    <Icon icon="game-icons:lock" width="40" height="40" className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Турниры недоступны на гостевом аккаунте.
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Зарегистрируйтесь, чтобы участвовать в турнирах.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:trophy" width="22" height="22" className="inline mr-2" />Турнир «Кровавый Шпиль»</h1>
            <p className="text-xs text-[var(--color-text-muted)] italic mb-4">
                «Раз в неделю ворота Арены закрываются. Наружу выходит только один.»
            </p>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            {data.tournaments.map((t: any) => {
                const myReg = t.myRegistration;
                const divisionLevels = t.division === 'copper' ? [1, 15] : t.division === 'steel' ? [16, 35] : t.division === 'mithril' ? [36, 60] : [61, 999];
                const isMyDivision = data.userLevel >= divisionLevels[0] && data.userLevel <= divisionLevels[1];

                // Группируем матчи по раундам
                const matchesByRound: Record<number, any[]> = {};
                if (t.matches) {
                    for (const m of t.matches) {
                        if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
                        matchesByRound[m.round].push(m);
                    }
                }
                const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

                return (
                    <Card key={t.id} className="mb-3" style={{ borderColor: isMyDivision ? divisionColors[t.division] : undefined }}>
                        {/* Заголовок */}
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold" style={{ color: divisionColors[t.division] }}>
                                {divisionIcons[t.division]} {divisionLabels[t.division]}
                                <span className="text-xs text-[var(--color-text-muted)] ml-1">
                                    (ур. {divisionLevels[0]}–{divisionLevels[1]})
                                </span>
                            </h3>
                            <span className="text-xs font-medium" style={{ color: statusColors[t.status] }}>
                                {statusLabels[t.status] || t.status}
                            </span>
                        </div>

                        {/* Инфо */}
                        <div className="text-xs text-[var(--color-text-muted)] mb-2">
                            <p>Призовой фонд: {formatMoney(t.prizePool)}</p>
                            <p>Участников: {t.participantCount}</p>
                            {t.participants.slice(0, 5).map((p: any) => (
                                <span key={p.id} className="mr-2">
                                    {p.username}
                                    {p.goldenTicket ? ' 🎫' : ''}
                                    {p.snapshotStats?.place === 1 ? ' 🏆' : p.snapshotStats?.place === 2 ? ' 🥈' : p.snapshotStats?.place === 3 ? ' 🥉' : ''}
                                </span>
                            ))}
                            {t.participantCount > 5 && <span>+ ещё {t.participantCount - 5}</span>}
                        </div>

                        {/* Регистрация */}
                        {t.status === 'registration' && isMyDivision && !myReg && (
                            <div className="flex gap-2">
                                <Button variant="danger" size="xs" onClick={() => handleRegister(t.division)}>
                                    Записаться (бесплатно)
                                </Button>
                                <Button variant="secondary" size="xs" onClick={() => handleRegister(t.division, true)}>
                                    🎫 Золотой билет (1000)
                                </Button>
                            </div>
                        )}
                        {myReg && (
                            <p className="text-xs text-[var(--color-accent-success)]">
                                ✅ Вы записаны {myReg.goldenTicket ? '🎫' : ''}
                                {myReg.snapshotStats?.place && ` — ${myReg.snapshotStats.place}-е место, приз: ${formatMoney(myReg.snapshotStats.prize || 0)}`}
                            </p>
                        )}

                        {/* Сетка матчей */}
                        {rounds.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Турнирная сетка</h4>
                                {rounds.map(round => {
                                    const roundMatches = matchesByRound[round];
                                    const totalRounds = rounds.length;
                                    const roundLabel = round === totalRounds ? '🏆 Финал' :
                                        round === totalRounds - 1 ? 'Полуфинал' :
                                        `Раунд ${round}`;

                                    return (
                                        <div key={round}>
                                            <p className="text-[0.6rem] font-bold text-[var(--color-text-muted)] uppercase mb-1">
                                                {roundLabel}
                                            </p>
                                            <div className="space-y-1">
                                                {roundMatches.map((m: any) => (
                                                    <div key={m.id}>
                                                        <div
                                                            className={`text-xs flex items-center gap-1 py-0.5 px-2 rounded ${
                                                                m.winnerId ? 'bg-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-card)]'
                                                            }`}
                                                        >
                                                            <span className={m.winnerId === m.player1Id ? 'font-bold text-[var(--color-accent-success)]' : ''}>
                                                                {m.player1Name || '—'}
                                                            </span>
                                                            <span className="text-[var(--color-text-muted)]">vs</span>
                                                            <span className={m.winnerId === m.player2Id ? 'font-bold text-[var(--color-accent-success)]' : ''}>
                                                                {m.player2Name || '—'}
                                                            </span>
                                                            {m.winnerId && (
                                                                <span
                                                                    className="ml-auto text-[0.6rem] text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                                                    onClick={() => setExpandedLog(expandedLog === m.id ? null : m.id)}
                                                                >
                                                                    {expandedLog === m.id ? 'Скрыть' : 'Бой'}
                                                                </span>
                                                            )}
                                                            {!m.winnerId && m.player1Id && m.player2Id && (
                                                                <span className="ml-auto text-[0.6rem] text-[var(--color-text-muted)]">⏳</span>
                                                            )}
                                                        </div>
                                                        {expandedLog === m.id && m.log && (
                                                            <div className="mt-1 p-2 bg-black/40 rounded text-[0.6rem] text-[var(--color-text-muted)] max-h-48 overflow-y-auto font-mono leading-relaxed">
                                                                {m.log.map((step: any, i: number) => (
                                                                    <div key={i} className={
                                                                        step.type === 'end' ? 'text-[var(--color-accent-success)] font-bold' :
                                                                        step.type === 'crit' ? 'text-yellow-400' :
                                                                        step.type === 'damage' ? 'text-red-400' :
                                                                        step.type === 'block' ? 'text-blue-400' :
                                                                        step.type === 'fullBlock' ? 'text-cyan-400 font-bold' :
                                                                        step.type === 'dodge' ? 'text-purple-400' :
                                                                        step.type === 'stun' ? 'text-orange-400' :
                                                                        step.type === 'counter' ? 'text-pink-400' :
                                                                        step.type === 'money' ? 'text-yellow-300' :
                                                                        ''
                                                                    }>
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

                        {/* Завершён — итоги */}
                        {t.status === 'completed' && (
                            <div className="mt-2 p-2 bg-[var(--color-bg-primary)] rounded text-xs">
                                <p className="font-bold text-[var(--color-accent-success)]">Турнир завершён!</p>
                                {t.participants
                                    .filter((p: any) => p.snapshotStats?.place)
                                    .sort((a: any, b: any) => a.snapshotStats.place - b.snapshotStats.place)
                                    .map((p: any) => (
                                        <p key={p.id} className="text-[var(--color-text-muted)]">
                                            {p.snapshotStats.place === 1 ? '🥇' : p.snapshotStats.place === 2 ? '🥈' : '🥉'}{' '}
                                            {p.username} — {formatMoney(p.snapshotStats.prize)}
                                        </p>
                                    ))}
                            </div>
                        )}
                    </Card>
                );
            })}

            {data.tournaments.length === 0 && (
                <Card className="text-center py-6">
                    <p className="text-sm text-[var(--color-text-muted)]">Нет активных турниров</p>
                </Card>
            )}
        </div>
    );
}
