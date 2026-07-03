import PageHeader from '../components/ui/PageHeader';
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
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/massacre'); if (c) setActionCard(c); }).catch(() => {}); }, []);
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

            if (data.lastEvent?.id) {
                fetchLog(data.lastEvent.id);
            }
            if (eventIdParam) {
                fetchLog(parseInt(eventIdParam));
            }
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

    useEffect(() => {
        const handler = (e: Event) => {
            const d = (e as CustomEvent).detail;
            setState((prev: any) => prev ? {
                ...prev,
                timeLeft: d.timeLeft ?? prev.timeLeft,
                event: prev.event ? { ...prev.event, participant_count: d.participant_count ?? prev.event.participant_count, status: d.status ?? prev.event.status } : prev.event,
            } : prev);
            if (d.status === 'finished' || d.status === 'in_progress') {
                fetchLog(d.id);
            }
        };
        window.addEventListener('massacreTick', handler);
        return () => window.removeEventListener('massacreTick', handler);
    }, []);

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

    // --- Визуализация ---
    const [vizMode, setVizMode] = useState(false);
    const [vizStep, setVizStep] = useState(-1);
    const [vizPlaying, setVizPlaying] = useState(false);
    const [vizSpeed, setVizSpeed] = useState(2);
    const vizTimer = useRef<number | null>(null);

    // Построить HP-трекер по ходам — каждый участник имеет историю HP на каждом шагу
    const hpMap = useRef<Map<number, { name: string; max: number; history: number[]; dead: boolean }>>(new Map());
    useEffect(() => {
        const map = new Map<number, { name: string; max: number; history: number[]; dead: boolean }>();
        // Инициализация: запоминаем имена и стартовое HP
        const currentHp = new Map<number, number>();
        for (const p of participants) {
            const hp = p.hp_max || p.maxHp || 100;
            map.set(p.id, { name: p.name, max: hp, history: [hp], dead: false });
            currentHp.set(p.id, hp);
        }
        // Проходим по всем строкам лога
        for (const t of turns) {
            // Применяем урон к цели
            if (t.damage > 0 && t.target_id && currentHp.has(t.target_id)) {
                const prev = currentHp.get(t.target_id) || 0;
                currentHp.set(t.target_id, Math.max(0, prev - t.damage));
            }
            // Отмечаем смерть
            if (t.action_type === 'death' && t.target_id) {
                const entry = map.get(t.target_id);
                if (entry) entry.dead = true;
            }
            // Записываем текущее HP ВСЕХ участников в историю
            for (const [pid, hp] of currentHp) {
                const entry = map.get(pid);
                if (entry) entry.history.push(hp);
            }
        }
        hpMap.current = map;
    }, [participants, turns]);

    const totalVizSteps = turns.length;
    const currentTurn = vizStep >= 0 && vizStep < turns.length ? turns[vizStep] : null;

    const startViz = () => {
        setVizStep(-1);
        setVizPlaying(true);
    };
    const stopViz = () => {
        setVizPlaying(false);
        if (vizTimer.current) clearInterval(vizTimer.current);
    };
    useEffect(() => {
        if (!vizPlaying) return;
        vizTimer.current = window.setInterval(() => {
            setVizStep(prev => {
                if (prev >= totalVizSteps - 1) {
                    stopViz();
                    return prev;
                }
                return prev + 1;
            });
        }, 1000 / vizSpeed);
        return () => { if (vizTimer.current) clearInterval(vizTimer.current); };
    }, [vizPlaying, vizSpeed, totalVizSteps]);

    const stepForward = () => {
        if (vizStep < totalVizSteps - 1) setVizStep(vizStep + 1);
    };
    const stepBack = () => {
        if (vizStep > 0) setVizStep(vizStep - 1);
    };

    // Карта HP на текущем шаге
    const getHpAtStep = (pid: number) => {
        const h = hpMap.current.get(pid);
        if (!h) return 0;
        const idx = Math.min(Math.max(0, vizStep + 1), h.history.length - 1);
        return h.history[idx] ?? 0;
    };
    const getMaxHp = (pid: number) => hpMap.current.get(pid)?.max || 100;
    const getPct = (pid: number) => {
        const max = getMaxHp(pid);
        if (max <= 0) return 0;
        return Math.max(0, Math.min(100, Math.round(getHpAtStep(pid) / max * 100)));
    };

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
          {actionCard && <PageHeader title="Резня" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
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

            {/* Кнопка визуализации */}
            {turns.length > 0 && (
                <>
                    <p className="text-xs text-[var(--color-text-muted)] mt-3 mb-1">История с последней резни:</p>
                    <div className="flex justify-center gap-2 mb-2">
                    <Button variant="secondary" size="md" onClick={() => setVizMode(!vizMode)}>
                        <Icon icon={vizMode ? 'game-icons:notebook' : 'game-icons:play-button'} width="14" height="14" className="inline mr-1" />
                        {vizMode ? 'Текстовый лог' : 'Визуализация боя'}
                    </Button>
                </div>
                </>
            )}

            {/* Визуализация */}
            {vizMode && turns.length > 0 && (
                <div className="mb-4">
                    {/* Карточки участников */}
                    <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))' }}>
                        {participants.map(p => {
                            const pct = getPct(p.id);
                            const hpBarColor = pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#ef4444';
                            const isDead = p.alive === false && vizStep >= totalVizSteps - 1;
                            const isActor = currentTurn?.actor_id === p.id;
                            const isTarget = currentTurn?.target_id === p.id;
                            const isMe = p.id === user.id;
                            return (
                                <div key={p.id} className={`relative rounded-lg p-2 text-center transition-all ${
                                    isDead ? 'opacity-40 grayscale' : ''
                                } ${
                                    isActor ? 'ring-2 ring-[var(--color-accent-info)] bg-blue-500/10' :
                                    isTarget ? 'ring-2 ring-red-500 bg-red-500/10' :
                                    'bg-[var(--color-bg-secondary)]'
                                } ${isMe && !isActor && !isTarget ? 'ring-2 ring-[var(--color-accent-warning)]' : ''}`}>
                                    <p className="text-[0.6rem] font-bold truncate mb-0.5">{p.name}</p>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-0.5">
                                        <div className="h-full rounded-full transition-all duration-300" style={{
                                            width: `${pct}%`,
                                            backgroundColor: hpBarColor,
                                        }} />
                                    </div>
                                    <p className="text-[0.5rem] text-[var(--color-text-muted)]">
                                        {getHpAtStep(p.id)}/{getMaxHp(p.id)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Текущий ход */}
                    {currentTurn && (
                        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-2 text-center mb-2 text-xs">
                            <span className="text-[var(--color-text-muted)]">Ход #{vizStep + 1}/{totalVizSteps}:</span>{' '}
                            <span className="font-bold">{currentTurn.message}</span>
                        </div>
                    )}

                    {/* Управление */}
                    <div className="flex items-center justify-center gap-3">
                        <Button variant="secondary" size="md" onClick={stepBack} disabled={vizStep <= 0}>⏮</Button>
                        {vizPlaying ? (
                            <Button variant="danger" size="md" onClick={stopViz}>⏸ Пауза</Button>
                        ) : (
                            <Button variant="danger" size="md" onClick={startViz} disabled={vizStep >= totalVizSteps - 1}>▶ Играть</Button>
                        )}
                        <Button variant="secondary" size="md" onClick={stepForward} disabled={vizStep >= totalVizSteps - 1}>⏭</Button>
                        <select value={vizSpeed} onChange={e => setVizSpeed(Number(e.target.value))}
                            className="bg-[var(--color-bg-input)] text-xs rounded px-1 py-0.5 border border-[var(--color-border-light)]">
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={4}>4x</option>
                        </select>
                    </div>
                    <div className="mt-1 text-center">
                        <input type="range" min={0} max={totalVizSteps - 1} value={vizStep} className="w-full h-1"
                            onChange={e => { setVizStep(Number(e.target.value)); stopViz(); }} />
                    </div>
                    {/* Легенда */}
                    <div className="flex flex-wrap justify-center gap-3 mt-2 text-[0.6rem] text-[var(--color-text-muted)]">
                        <span>🟦 — атакующий</span>
                        <span>🟥 — цель атаки</span>
                        <span>🟨 — ваш персонаж</span>
                    </div>
                </div>
            )}

            {/* Текстовый лог */}
            {!vizMode && turns.length > 0 && (
                <div className="mt-4">
                    <h2 className="text-sm font-bold text-[var(--color-text-muted)] mb-2">
                        📜 Лог боя — {participants.length} участников
                    </h2>

                    <div className="flex flex-wrap gap-1 mb-3">
                        {participants.map((p: any) => (
                            <span key={p.id} className={`text-xs px-2 py-0.5 rounded ${
                                p.id === user.id
                                    ? 'bg-[#3d2e00] text-[#f0c040] border border-[#5a4200]'
                                    : p.alive === false
                                    ? 'bg-[#2a2a2a] text-[#777] line-through'
                                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                            }`}>
                                {p.name} (ур.{p.level})
                            </span>
                        ))}
                    </div>

                    <div
                        ref={logRef}
                        className="bg-[var(--color-bg-secondary)] rounded-lg p-3 max-h-[50vh] overflow-y-auto font-mono text-xs leading-relaxed space-y-1"
                    >
                        {turns.map((t, i) => {
                            const act = actionLabels[t.action_type] || { icon: '❓', color: '#aaa', label: t.action_type };
                            const isMy = t.isMyTurn;
                            return (
                                <div
                                    key={i}
                                    className={`px-2 py-1 rounded border ${
                                        isMy
                                            ? 'bg-[#3d2e00] border-[#5a4200]'
                                            : 'border-transparent'
                                    }`}
                                >
                                    <span className="text-[0.6rem] text-[var(--color-text-muted)] mr-1">
                                        #{t.turn_number}
                                    </span>
                                    <span style={{ color: act.color }}>{act.icon}</span>{' '}
                                    <span className={isMy ? 'font-bold text-[#f0c040]' : ''}>
                                        {isMy && '👉 '}{t.message}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
