import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getHeaders } from '../api/helpers';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import BackButton from '../components/BackButton';

interface EnemyView {
    id: number; name: string; hp: number; maxHp: number; isBoss: boolean;
}

interface SkillInfo {
    id: number; name: string; nameRu: string; rage: number; cooldown: number;
    desc: string; level: number;
}

export default function DungeonPage() {
    const { user: _user } = useAuth();

    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Боевое состояние
    const [inCombat, setInCombat] = useState(false);
    const [floor, setFloor] = useState(1);
    const [playerHp, setPlayerHp] = useState(100);
    const [playerMaxHp, setPlayerMaxHp] = useState(100);
    const [enemies, setEnemies] = useState<EnemyView[]>([]);
    const [rage, setRage] = useState(0);
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [buffs, setBuffs] = useState<any[]>([]);
    const [cooldowns, setCooldowns] = useState<Record<number, number>>({});
    const [combatLog, setCombatLog] = useState<string[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<number[]>([1, 2, 3, 4]);
    const [cleared, setCleared] = useState(false);
    const [dead, setDead] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [claimResult, setClaimResult] = useState<any>(null);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    // Загружаем статус
    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        try {
            const res = await fetch('/api/dungeon/status', { headers: getHeaders() });
            const data = await res.json();
            setStatus(data);
            if (data.active) {
                setInCombat(true);
                setFloor(data.currentFloor);
                setPlayerHp(data.playerHp);
                setPlayerMaxHp(data.playerMaxHp);
                setEnemies(data.enemies || []);
                setRage(data.rage || 0);
                if (data.cleared) setCleared(true);
                startPolling();
            }
        } catch { /* */ }
    };

    const startPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/dungeon/state', { headers: getHeaders() });
                const data = await res.json();
                if (!data.active) {
                    stopPolling();
                    setInCombat(false);
                    if (data.dead) setDead(true);
                    loadStatus();
                    return;
                }
                setPlayerHp(data.playerHp);
                setEnemies(data.enemies || []);
                setRage(data.rage);
                setBuffs(data.buffs || []);
                setCooldowns(data.skillCooldowns || {});
                if (data.cleared) {
                    setCleared(true);
                    stopPolling();
                }
                if (data.dead) {
                    setDead(true);
                    setInCombat(false);
                    stopPolling();
                }
                if (data.log && data.log.length > 0) {
                    setCombatLog(prev => [...prev, ...data.log].slice(-50));
                }
            } catch { /* */ }
        }, 500);
    };

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    useEffect(() => { return () => stopPolling(); }, []);

    // Скролл лога вниз
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [combatLog]);

    const handleStart = async (startFloor?: number) => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/dungeon/start', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ skills: selectedSkills, startFloor }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setInCombat(true);
            setDead(false);
            setCleared(false);
            setClaimed(false);
            setClaimResult(null);
            setFloor(data.floor);
            setPlayerHp(data.playerHp);
            setPlayerMaxHp(data.playerMaxHp);
            setEnemies(data.enemies);
            setRage(0);
            setSkills(data.skills || []);
            setBuffs([]);
            setCooldowns({});
            setCombatLog([]);
            startPolling();
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleContinue = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/continue', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ skills: selectedSkills }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCleared(false);
            setClaimed(false);
            setClaimResult(null);
            setFloor(data.floor);
            setPlayerHp(data.playerHp);
            setPlayerMaxHp(data.playerMaxHp);
            setEnemies(data.enemies);
            setRage(0);
            setSkills(data.skills || []);
            setBuffs([]);
            setCooldowns({});
            setCombatLog([]);
            setInCombat(true);
            startPolling();
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleSkill = async (skillId: number) => {
        try {
            const res = await fetch('/api/dungeon/skill', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ skillId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            // Мгновенное обновление
            if (data.enemies) setEnemies(data.enemies);
            setPlayerHp(data.playerHp);
            setRage(data.rage);
            setBuffs(data.buffs || []);
            setCooldowns(data.skillCooldowns || {});
            if (data.log) setCombatLog(prev => [...prev, ...data.log].slice(-50));
        } catch (e: any) { setMessage(e.message); }
    };

    const handleTarget = async (enemyId: number) => {
        try {
            const res = await fetch('/api/dungeon/target', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ enemyId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
        } catch { /* */ }
    };

    const handleClaim = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/claim', {
                method: 'POST',
                headers: getHeaders(),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setClaimed(true);
            setClaimResult(data);
            setPlayerHp(data.playerHp);
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleFlee = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/flee', {
                method: 'POST',
                headers: getHeaders(),
            });
            const data = await res.json();
            setInCombat(false);
            setMessage(data.message || 'Вы сбежали');
            stopPolling();
            loadStatus();
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const toggleSkill = (id: number) => {
        setSelectedSkills(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 4) return prev;
            return [...prev, id];
        });
    };

    const hpPct = playerMaxHp > 0 ? (playerHp / playerMaxHp) * 100 : 0;
    const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444';

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4 text-center">🏰 Подземелье</h1>

            {message && <p className="text-sm text-center mb-3 text-[var(--color-accent-warning)]">{message}</p>}

            {/* Вне боя: статус */}
            {!inCombat && !claimed && status && (
                <Card>
                    <p className="text-sm mb-2">
                        Попыток сегодня: {status.remainingRuns}/{4} · Кулдаун: {status.cooldownRemaining > 0
                            ? `${Math.floor(status.cooldownRemaining / 3600)}ч ${Math.floor((status.cooldownRemaining % 3600) / 60)}м`
                            : 'Готов'}
                    </p>
                    {status.checkpointFloor > 0 && (
                        <p className="text-sm text-[var(--color-accent-info)] mb-2">
                            Чекпоинт: этаж {status.checkpointFloor}
                        </p>
                    )}

                    {/* Выбор скиллов */}
                    <div className="mb-3">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">Скиллы в бой (макс 4):</p>
                        <div className="flex flex-wrap gap-1">
                            {SKILLS_ALL.map(s => (
                                <button key={s.id}
                                    onClick={() => toggleSkill(s.id)}
                                    className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${selectedSkills.includes(s.id)
                                        ? 'bg-[var(--color-accent-info)] text-white'
                                        : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'}`}>
                                    {s.nameRu}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <Button variant="danger" size="md" onClick={() => handleStart()}
                            disabled={loading || status.remainingRuns <= 0 || status.cooldownRemaining > 0}>
                            🗡️ В бой!
                        </Button>
                        {status.checkpointFloor > 0 && (
                            <Button variant="secondary" size="md" onClick={() => handleStart(status.checkpointFloor)}
                                disabled={loading || status.remainingRuns <= 0 || status.cooldownRemaining > 0}>
                                ⚡ С чекпоинта ({status.checkpointFloor})
                            </Button>
                        )}
                    </div>
                </Card>
            )}

            {/* После забора награды */}
            {claimed && claimResult && (
                <Card>
                    <h3 className="font-bold text-lg mb-2 text-center text-[var(--color-accent-success)]">🏆 Этаж {claimResult.floor} пройден!</h3>
                    <div className="space-y-1 mb-3">
                        <p className="text-sm">💰 Серебро: +{claimResult.silver.toLocaleString()}</p>
                        {claimResult.item && <p className="text-sm">🔮 {claimResult.item.name} ({claimResult.item.rarity})</p>}
                        {claimResult.page && <p className="text-sm">📜 Страница: {claimResult.page.name}</p>}
                        {claimResult.isBoss && <p className="text-sm text-[var(--color-accent-gold)]">⭐ Чекпоинт сохранён!</p>}
                    </div>
                    <p className="text-sm mb-2">HP после отдыха: {claimResult.playerHp}/{playerMaxHp}</p>
                    <div className="flex gap-2">
                        <Button variant="danger" size="md" onClick={handleContinue}>➡ Этаж {claimResult.nextFloor}</Button>
                        <Button variant="secondary" size="md" onClick={() => { setClaimed(false); loadStatus(); }}>Выйти</Button>
                    </div>
                </Card>
            )}

            {/* Смерть */}
            {dead && (
                <Card>
                    <h3 className="font-bold text-lg mb-2 text-center text-[var(--color-accent-danger)]">💀 Вы погибли</h3>
                    <p className="text-sm text-center mb-3">Награда потеряна. Попробуйте снова через 6 часов.</p>
                    <Button variant="secondary" size="md" fullWidth onClick={() => { setDead(false); loadStatus(); }}>Понятно</Button>
                </Card>
            )}

            {/* Бой */}
            {inCombat && (
                <div className="space-y-3">
                    {/* Игрок */}
                    <Card>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold">Этаж {floor}</span>
                            <span className="text-xs">HP {playerHp}/{playerMaxHp}</span>
                        </div>
                        <div className="h-3 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                        </div>
                        {/* Ярость */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-[var(--color-text-muted)]">Ярость</span>
                            <div className="flex-1 h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rage}%` }} />
                            </div>
                            <span className="text-xs font-bold text-red-400">{rage}</span>
                        </div>
                        {/* Баффы */}
                        {buffs.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {buffs.map(b => (
                                    <span key={b.id} className="text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--color-accent-info)]/20 text-[var(--color-accent-info)]">
                                        {SKILLS_ALL.find(s => s.name === b.id)?.nameRu || b.id} {Math.ceil(b.endsAt - Date.now() / 1000)}с
                                    </span>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Враги */}
                    <div className="space-y-2">
                        {enemies.map((e, i) => {
                            const eHpPct = e.maxHp > 0 ? (e.hp / e.maxHp) * 100 : 0;
                            const isTarget = i === 0;
                            return (
                                <div key={e.id}
                                    onClick={() => handleTarget(e.id)}
                                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${isTarget
                                        ? 'border-[var(--color-accent-danger)] bg-[var(--color-accent-danger)]/10'
                                        : 'border-[var(--color-border-light)] bg-[var(--color-bg-card)]'}`}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={e.isBoss ? 'text-[var(--color-accent-gold)] font-bold' : ''}>
                                            {isTarget && '🎯 '}{e.isBoss && '👑 '}{e.name}
                                        </span>
                                        <span>{e.hp}/{e.maxHp}</span>
                                    </div>
                                    <div className="h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.max(0, eHpPct)}%`, backgroundColor: eHpPct > 30 ? '#ef4444' : '#991b1b' }} />
                                    </div>
                                </div>
                            );
                        })}
                        {enemies.length === 0 && !cleared && !dead && (
                            <p className="text-sm text-center">Врагов нет</p>
                        )}
                    </div>

                    {/* Скиллы */}
                    <div className="grid grid-cols-2 gap-2">
                        {skills.map(s => {
                            const onCd = cooldowns[s.id] && cooldowns[s.id] > Date.now() / 1000;
                            const cdLeft = onCd ? Math.ceil(cooldowns[s.id] - Date.now() / 1000) : 0;
                            const canUse = !onCd && rage >= s.rage && !cleared;
                            return (
                                <button key={s.id}
                                    onClick={() => handleSkill(s.id)}
                                    disabled={!canUse}
                                    className={`p-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${canUse
                                        ? 'bg-[var(--color-accent-info)]/20 border border-[var(--color-accent-info)] hover:bg-[var(--color-accent-info)]/30 text-[var(--color-text-primary)]'
                                        : 'bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-[var(--color-text-muted)] opacity-60'}`}>
                                    <div className="font-bold">{s.nameRu} {s.level > 0 && `+${s.level}`}</div>
                                    <div className="text-[0.6rem]">
                                        {onCd ? `⏳ ${cdLeft}с` : `${s.rage} ярости`}
                                    </div>
                                    <div className="text-[0.6rem] text-[var(--color-text-muted)]">{s.desc}</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Лог */}
                    <Card>
                        <div ref={logRef} className="text-xs text-[var(--color-text-muted)] max-h-32 overflow-y-auto space-y-0.5">
                            {combatLog.map((l, i) => (
                                <div key={i}>{l}</div>
                            ))}
                            {combatLog.length === 0 && <div>Бой начинается...</div>}
                        </div>
                    </Card>

                    {/* Кнопки действий */}
                    {cleared && (
                        <div className="flex gap-2">
                            <Button variant="danger" size="md" onClick={handleClaim} disabled={loading}>
                                🏆 Забрать награду
                            </Button>
                            <Button variant="secondary" size="md" onClick={handleFlee} disabled={loading}>
                                🏃 Сбежать
                            </Button>
                        </div>
                    )}
                    {!cleared && (
                        <Button variant="secondary" size="md" fullWidth onClick={handleFlee} disabled={loading}>
                            🏃 Сбежать (потеря лута)
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

const SKILLS_ALL = [
    { id: 1, name: 'shield_bash', nameRu: 'Удар щитом' },
    { id: 2, name: 'sweep', nameRu: 'Размах' },
    { id: 3, name: 'battle_cry', nameRu: 'Боевой клич' },
    { id: 4, name: 'rend', nameRu: 'Раздирание' },
    { id: 5, name: 'execute', nameRu: 'Добивание' },
    { id: 6, name: 'demoralize', nameRu: 'Деморализация' },
    { id: 7, name: 'charge', nameRu: 'Рывок' },
    { id: 8, name: 'whirlwind', nameRu: 'Вихрь' },
];
