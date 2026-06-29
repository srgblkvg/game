import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import BackButton from '../components/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { getHeaders } from '../api/helpers';
import { formatMoney } from '../utils/money';

interface MassacreState {
    event: { id: number; status: string; entry_fee: number; participant_count: number; gathering_end?: number } | null;
    myParticipation: boolean;
    timeLeft: number;
}

interface TurnEntry {
    id: number;
    turn_number: number;
    actor_id: number;
    actor_name: string;
    target_id: number | null;
    target_name: string | null;
    action_type: string;
    damage: number;
    message: string;
    isMyTurn: boolean;
}

const actionLabels: Record<string, { icon: string; color: string; label: string }> = {
    attack: { icon: '⚔️', color: '#e74c3c', label: 'Атака' },
    dodge: { icon: '💨', color: '#f1c40f', label: 'Уклонение' },
    crit: { icon: '💥', color: '#e74c3c', label: 'Крит' },
    block: { icon: '🛡️', color: '#3498db', label: 'Блок' },
    fullBlock: { icon: '🛡️', color: '#9b59b6', label: 'Полный блок' },
    counter: { icon: '↩️', color: '#f1c40f', label: 'Контратака' },
    stun: { icon: '💫', color: '#f1c40f', label: 'Оглушение' },
    stunned_skip: { icon: '😵', color: '#95a5a6', label: 'Пропуск хода' },
    damage: { icon: '🗡️', color: '#e74c3c', label: 'Урон' },
    death: { icon: '💀', color: '#c0392b', label: 'Смерть' },
    victory: { icon: '🏆', color: '#f1c40f', label: 'Победа' },
};

export default function MassacrePage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const eventIdParam = searchParams.get('eventId');
    const [state, setState] = useState<MassacreState | null>(null);
    const [turns, setTurns] = useState<TurnEntry[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [joined, setJoined] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

    const fetchState = async () => {
        try {
            const res = await fetch('/api/massacre/state', { headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setState(data);
            setJoined(data.myParticipation);

            // Загружаем лог последнего завершённого боя
            if (data.lastEvent?.id) {
                fetchLog(data.lastEvent.id);
            }
            // Если передан конкретный eventId — грузим его лог
            if (eventIdParam) {
                fetchLog(parseInt(eventIdParam));
            }
            // Если текущий бой завершён или идёт — тоже грузим лог
            if (data.event && (data.event.status === 'finished' || data.event.status === 'in_progress')) {
                fetchLog(data.event.id);
            }
        } catch { setError('Ошибка сети'); }
    };

    const fetchLog = async (eventId: number) => {
        try {
            const res = await fetch(`/api/massacre/log/${eventId}`, { headers: getHeaders() });
            const data = await res.json();
            if (res.ok) {
                setTurns(data.turns || []);
                setParticipants(data.participants || []);
            }
        } catch {}
    };

    useEffect(() => { fetchState(); }, []);

    // Обновление через WS serverTick
    useEffect(() => {
        const handler = (e: Event) => {
            const d = (e as CustomEvent).detail;
            setState((prev: any) => prev ? {
                ...prev,
                timeLeft: d.timeLeft ?? prev.timeLeft,
                event: prev.event ? { ...prev.event, participant_count: d.participant_count ?? prev.event.participant_count, status: d.status ?? prev.event.status } : prev.event,
            } : prev);
            // Если статус изменился на finished/in_progress — грузим лог
            if (d.status === 'finished' || d.status === 'in_progress') {
                fetchLog(d.id);
            }
        };
        window.addEventListener('massacreTick', handler);
        return () => window.removeEventListener('massacreTick', handler);
    }, []);

    // Скролл лога вниз
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [turns]);

    const handleJoin = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/massacre/join', {
                method: 'POST',
                headers: getHeaders(),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); setLoading(false); return; }
            setJoined(true);
            // Обновить деньги
            if (character) {
                setCharacter({ ...character, money: character.money - 100 });
            }
            fetchState();
        } catch { setError('Ошибка сети'); }
        setLoading(false);
    };

    if (!user || !character) return null;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isGathering = state?.event?.status === 'gathering' && state.timeLeft > 0;
    const isStarting = state?.event?.status === 'starting' || (state?.event?.status === 'gathering' && state.timeLeft <= 0);
    const isInProgress = state?.event?.status === 'in_progress';
    const isFinished = state?.event?.status === 'finished';

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            <h1 className="text-center text-xl font-bold mb-4">
                <Icon icon="game-icons:battered-axe" width="22" height="22" className="inline mr-2" />
                Резня
            </h1>

            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-4">
                Хаотичный массовый PvP-бой без правил. Вход — {formatMoney(100)}. Сбор участников длится 30 минут,
                затем все сражаются, атакуя случайного противника.
                Победитель получает +10 опыта и весь призовой фонд. Выживает сильнейший!
            </p>

            {/* Сбор участников */}
            {isGathering && (
                <Card className="text-center">
                    <p className="text-sm text-[var(--color-text-muted)] mb-2">
                        Сбор участников. Вход: {formatMoney(state!.event!.entry_fee)}. Бой начнётся через:
                    </p>
                    <p className="text-3xl font-bold text-[var(--color-accent-danger)] mb-4">
                        {formatTime(state!.timeLeft)}
                    </p>
                    <p className="text-sm mb-4">
                        Участников: <span className="font-bold text-[var(--color-accent-warning)]">{state!.event!.participant_count}</span>
                    </p>

                    {!joined ? (
                        <Button
                            variant="danger"
                            size="md"
                            onClick={handleJoin}
                            disabled={loading || character.money < 100}
                            className="w-full sm:w-auto"
                        >
                            {loading ? 'Вступление...' : `Вступить (${formatMoney(100)})`}
                        </Button>
                    ) : (
                        <p className="text-[var(--color-accent-success)] text-sm font-bold">
                            <Icon icon="game-icons:checked-shield" width="14" height="14" className="inline mr-1" />
                            Вы в резне! Ожидайте начала боя...
                        </p>
                    )}

                    {character.money < 100 && !joined && (
                        <p className="text-[var(--color-accent-danger)] text-xs mt-2">Недостаточно серебра</p>
                    )}
                </Card>
            )}

            {/* Бой начинается */}
            {isStarting && (
                <Card className="text-center">
                    <p className="text-lg font-bold text-[var(--color-accent-warning)] mb-2">
                        ⏳ Сбор завершён! Бой начинается...
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Участников: {state!.event!.participant_count}
                    </p>
                </Card>
            )}

            {/* Бой идёт */}
            {isInProgress && (
                <Card className="text-center">
                    <p className="text-lg font-bold text-[var(--color-accent-danger)] mb-2">
                        ⚔️ Бой в процессе!
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Участников: {state!.event!.participant_count}
                    </p>
                </Card>
            )}

            {/* Лог боя */}
            {(turns.length > 0) && (
                <div className="mt-4">
                    <h2 className="text-sm font-bold text-[var(--color-text-muted)] mb-2">
                        📜 Лог боя — {participants.length} участников
                    </h2>

                    {/* Участники */}
                    <div className="flex flex-wrap gap-1 mb-3">
                        {participants.map((p: any) => (
                            <span key={p.id} className={`text-xs px-2 py-0.5 rounded ${
                                p.id === user.id
                                    ? 'bg-[var(--color-accent-warning)]/20 text-[var(--color-accent-warning)] border border-[var(--color-accent-warning)]/30'
                                    : p.alive === false
                                    ? 'bg-gray-700/30 text-gray-500 line-through'
                                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                            }`}>
                                {p.name} (ур.{p.level})
                            </span>
                        ))}
                    </div>

                    {/* Ходы */}
                    <div
                        ref={logRef}
                        className="bg-[var(--color-bg-primary)]/90 rounded-lg p-3 max-h-[50vh] overflow-y-auto font-mono text-xs leading-relaxed space-y-1"
                    >
                        {turns.map((t, i) => {
                            const act = actionLabels[t.action_type] || { icon: '❓', color: '#aaa', label: t.action_type };
                            const isMy = t.isMyTurn;
                            return (
                                <div
                                    key={i}
                                    className={`px-2 py-1 rounded border ${
                                        isMy
                                            ? 'bg-[var(--color-accent-warning)]/10 border-[var(--color-accent-warning)]/30'
                                            : 'border-transparent'
                                    }`}
                                >
                                    <span className="text-[0.6rem] text-[var(--color-text-muted)] mr-1">
                                        #{t.turn_number}
                                    </span>
                                    <span style={{ color: act.color }}>{act.icon}</span>{' '}
                                    <span className={isMy ? 'font-bold text-[var(--color-accent-warning)]' : ''}>
                                        {isMy && '👉 '}{t.message}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Завершён но лога нет (ждём) */}
            {isFinished && turns.length === 0 && (
                <Card className="text-center">
                    <p className="text-sm text-[var(--color-text-muted)]">Загрузка результатов...</p>
                </Card>
            )}

            {error && (
                <Card className="text-center mt-4">
                    <p className="text-[var(--color-accent-danger)] text-sm">{error}</p>
                </Card>
            )}
        </div>
    );
}
