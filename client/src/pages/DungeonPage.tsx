import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getHeaders } from '../api/helpers';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import BackButton from '../components/BackButton';
import CharacterCard from '../components/CharacterCard';
import { useGame } from '../contexts/GameContext';
import { toCharCardData } from '../utils/character';

interface EnemyView {
    id: number; name: string; hp: number; maxHp: number; isBoss: boolean;
    attackProgress: number;
}

interface SkillInfo {
    id: number; name: string; nameRu: string; rageCost: number; rageGain: number; cooldown: number;
    desc: string; descScale: string; level: number;
}

function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 50%, 35%)`;
}

export default function DungeonPage() {
    const { user: _user } = useAuth();
    const { character, setCharacter } = useGame();

    const [tab, setTab] = useState<'status' | 'prepare'>('status');
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
    const [playerAttackProgress, setPlayerAttackProgress] = useState(0);
    const [attackSpeed, setAttackSpeed] = useState('0');
    const animRef = useRef<number>(0);
    const lastProgressRef = useRef({ progress: 0, time: 0 });
    const [selectedSkills, setSelectedSkills] = useState<number[]>([1, 2, 3]);
    const [cleared, setCleared] = useState(false);
    const [dead, setDead] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [claimResult, setClaimResult] = useState<any>(null);
    const [exited, setExited] = useState(false);
    const [pages, setPages] = useState<any[]>([]);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadStatus(); loadPages(); }, []);

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

    const loadPages = async () => {
        try {
            const res = await fetch('/api/dungeon/pages', { headers: getHeaders() });
            const data = await res.json();
            setPages(data.pages || []);
        } catch { /* */ }
    };

    const startPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/dungeon/state', { headers: getHeaders() });
                const data = await res.json();
                if (!data.active) { stopPolling(); setInCombat(false); if (data.dead) setDead(true); loadStatus(); return; }
                setPlayerHp(data.playerHp);
                setEnemies(data.enemies || []);
                setRage(data.rage);
                setBuffs(data.buffs || []);
                setCooldowns(data.skillCooldowns || {});
                setPlayerAttackProgress(data.playerAttackProgress || 0);
                setAttackSpeed(data.attackSpeed || '0');
                // Синхронизация: серверное значение корректирует анимацию
                lastProgressRef.current = { progress: data.playerAttackProgress || 0, time: Date.now() };
                if (data.cleared) { setCleared(true); stopPolling(); }
                if (data.dead) { setDead(true); setInCombat(false); stopPolling(); }
                if (data.log?.length) setCombatLog(prev => [...prev, ...data.log].slice(-50));
            } catch { /* */ }
        }, 100);
    };

    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    useEffect(() => { return () => stopPolling(); }, []);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [combatLog]);

    // Плавная анимация прогресс-бара атаки
    useEffect(() => {
        if (!inCombat) return;
        const tick = () => {
            const now = Date.now();
            const lp = lastProgressRef.current;
            const speed = parseFloat(attackSpeed) || 0.5;
            const interval = 1 / speed; // seconds per attack
            const elapsed = (now - lp.time) / 1000;
            const estimated = Math.min(1, lp.progress + elapsed / interval);
            setPlayerAttackProgress(estimated);
            if (estimated >= 1) {
                lastProgressRef.current = { progress: 0, time: now };
            }
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animRef.current);
    }, [inCombat, attackSpeed]);

    // Получить список доступных чекпоинтов (кратные 5)
    const getCheckpoints = () => {
        if (!status) return [];
        const maxFloor = status.checkpointFloor || 0;
        const points = [1]; // всегда с 1-го можно
        for (let f = 5; f <= maxFloor; f += 5) points.push(f);
        return points;
    };

    const handleStart = async (startFloor: number) => {
        setLoading(true); setMessage('');
        try {
            const res = await fetch('/api/dungeon/start', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ skills: selectedSkills, startFloor }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setInCombat(true); setDead(false); setCleared(false); setClaimed(false); setClaimResult(null);
            setFloor(data.floor); setPlayerHp(data.playerHp); setPlayerMaxHp(data.playerMaxHp);
            setEnemies(data.enemies); setRage(0); setSkills(data.skills || []); setBuffs([]); setCooldowns({}); setCombatLog([]);
            startPolling();
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleContinue = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/continue', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ skills: selectedSkills }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCleared(false); setClaimed(false); setClaimResult(null);
            setFloor(data.floor); setPlayerHp(data.playerHp); setPlayerMaxHp(data.playerMaxHp);
            setEnemies(data.enemies); setRage(0); setSkills(data.skills || []); setBuffs([]); setCooldowns({}); setCombatLog([]);
            setInCombat(true); startPolling();
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleSkill = async (skillId: number) => {
        try {
            const res = await fetch('/api/dungeon/skill', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ skillId }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.enemies) setEnemies(data.enemies);
            setPlayerHp(data.playerHp); setRage(data.rage); setBuffs(data.buffs || []); setCooldowns(data.skillCooldowns || {});
            if (data.log) setCombatLog(prev => [...prev, ...data.log].slice(-50));
        } catch (e: any) { setMessage(e.message); }
    };

    const handleTarget = async (enemyId: number) => {
        try {
            await fetch('/api/dungeon/target', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ enemyId }) });
        } catch { /* */ }
    };

    const handleClaim = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/claim', { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setClaimed(true); setClaimResult(data); setPlayerHp(data.playerHp);
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleFlee = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/flee', { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            setInCombat(false); setMessage(data.message || 'Вы сбежали'); stopPolling(); loadStatus();
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleUpgradeSkill = async (skillId: number) => {
        try {
            const res = await fetch('/api/dungeon/upgrade-skill', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ skillId }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            loadPages(); loadStatus();
            setMessage(`Скилл улучшен до уровня ${data.newLevel}!`);
        } catch (e: any) { setMessage(e.message); }
    };

    const toggleSkill = (id: number, _minLevel: number) => {
        const level = getSkillLevel(id);
        if (level < 1) return;
        setSelectedSkills(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 4) return prev;
            return [...prev, id];
        });
    };

    const getPageCount = (skillId: number) => pages.find(p => p.skillId === skillId)?.count || 0;
    const getSkillLevel = (skillId: number) => pages.find(p => p.skillId === skillId)?.level || 0;
    const getUpgradeCost = (skillId: number) => {
        const level = getSkillLevel(skillId);
        return { pages: 10 + level * 15, silver: 1000 * Math.pow(3, level) };
    };

    const hpPct = playerMaxHp > 0 ? (playerHp / playerMaxHp) * 100 : 0;
    const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444';

    // Базовая страница статуса — выбор этажа и старт
    const renderStatus = () => (
        <Card>
            <p className="text-sm mb-2">
                Попыток сегодня: {status?.remainingRuns ?? 0}/4
                {status?.cooldownRemaining > 0 && (
                    <span className="text-[var(--color-text-muted)]"> · Кулдаун: {Math.floor(status.cooldownRemaining / 3600)}ч {Math.floor((status.cooldownRemaining % 3600) / 60)}м</span>
                )}
            </p>

            <h3 className="text-sm font-bold mb-2">Выбор этажа:</h3>
            <div className="space-y-2 mb-4">
                {getCheckpoints().map(cp => (
                    <div key={cp} className={`p-3 rounded-lg border cursor-pointer transition-colors ${cp === 1 || cp % 5 === 0
                        ? 'border-[var(--color-border-light)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-info)]'
                        : 'opacity-50'}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold">
                                {cp === 1 ? '🏁 Этаж 1 (начало)' : `⭐ Этаж ${cp} (босс)`}
                            </span>
                            <Button variant="danger" size="md"
                                onClick={() => handleStart(cp)}
                                disabled={loading || status?.remainingRuns <= 0 || status?.cooldownRemaining > 0}>
                                🗡️ В бой
                            </Button>
                        </div>
                    </div>
                ))}
                {getCheckpoints().length === 1 && (
                    <p className="text-xs text-[var(--color-text-muted)]">Новые чекпоинты открываются на этажах-боссах (5, 10, 15...)</p>
                )}
            </div>
        </Card>
    );

    const handleSwitchSet = async (slot: number) => {
        try {
            const res = await fetch('/api/character/switch-equip', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ slot }),
            });
            if (res.ok) {
                const { fetchCharacter } = await import('../api/character');
                const fresh = await fetchCharacter();
                setCharacter(fresh);
            }
        } catch { /* */ }
    };

    // Вкладка Подготовка — умения
    const renderPrepare = () => {
        const c = character as any;
        const equipSets = {
            1: c?.equipment1 ?? {},
            2: c?.equipment2 ?? {},
            3: c?.equipment3 ?? {},
        };
        const activeSlot = c?.activeEquipSlot || 1;

        const SKILL_ICONS: Record<number, string> = {
            1: '🛡️', 2: '⚔️', 3: '📢', 4: '🩸', 5: '💀', 6: '😨', 7: '🏃', 8: '🌀',
        };

        return (
        <div className="md:flex md:gap-8 md:items-start space-y-4 md:space-y-0">
            <div className="md:w-[220px] md:shrink-0 flex justify-center md:block">
                {character && (
                    <CharacterCard
                        key={activeSlot}
                        char={toCharCardData(character)}
                        compact
                        equipSets={equipSets}
                        activeEquipSlot={activeSlot}
                        onSwitchSet={handleSwitchSet}
                    />
                )}
            </div>
            <Card className="flex-1 min-w-0">
            {/* Экипированные умения */}
            <h3 className="text-sm font-bold mb-3">🔧 Экипировано умений: {selectedSkills.length} из 4</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 1, 2, 3].map(i => {
                    const sid = selectedSkills[i];
                    const skill = sid ? SKILLS_ALL.find(s => s.id === sid) : null;
                    return (
                        <div key={i} className={`p-2 rounded-lg border text-center min-h-[60px] flex flex-col items-center justify-center ${skill
                            ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/10'
                            : 'border-dashed border-[var(--color-border-light)] bg-[var(--color-bg-input)]'}`}>
                            {skill ? (
                                <>
                                    <span className="text-lg">{SKILL_ICONS[skill.id] || '❓'}</span>
                                    <span className="text-[0.6rem] font-bold mt-1">{skill.nameRu}</span>
                                </>
                            ) : (
                                <span className="text-[0.6rem] text-[var(--color-text-muted)]">Пусто</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Список умений */}
            <h3 className="text-sm font-bold mb-3">📜 Все умения</h3>
            <div className="space-y-2">
                {SKILLS_ALL.map(s => {
                    const level = getSkillLevel(s.id);
                    const pagesCount = getPageCount(s.id);
                    const cost = getUpgradeCost(s.id);
                    const selected = selectedSkills.includes(s.id);
                    const canSelect = level >= 1;

                    return (
                        <div key={s.id} className={`p-3 rounded-lg border ${selected ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/10' : 'border-[var(--color-border-light)] bg-[var(--color-bg-card)]'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <span className="text-lg mr-1">{SKILL_ICONS[s.id] || '❓'}</span>
                                    <span className="text-sm font-bold">{s.nameRu}</span>
                                    <span className="text-xs text-[var(--color-text-accent)] ml-1">уровень {level}</span>
                                    {!canSelect && <span className="text-xs text-[var(--color-text-muted)] ml-1">(нужен уровень 1)</span>}
                                </div>
                                <button onClick={() => toggleSkill(s.id, level)}
                                    disabled={!canSelect}
                                    className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${selected
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                        : canSelect
                                            ? 'bg-[var(--color-accent-info)]/20 text-[var(--color-accent-info)] border border-[var(--color-accent-info)]/50 hover:bg-[var(--color-accent-info)]/30'
                                            : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] opacity-50'}`}>
                                    {selected ? 'Убрать' : 'Взять'}
                                </button>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">{s.desc}</p>
                            <p className="text-[0.6rem] text-[var(--color-accent-purple)] mb-2">За уровень: {s.descScale}</p>
                            <div className="flex items-center gap-2 text-[0.6rem]">
                                <span className="text-[var(--color-text-muted)]">{s.rageCost > 0 ? `⚡ ${s.rageCost} ярости` : `✨ +${s.rageGain} ярости`}</span>
                                {s.cooldown > 0 && <span className="text-[var(--color-text-muted)]">⏳ {s.cooldown}с</span>}
                                <span className="text-[var(--color-text-muted)]">📜 {pagesCount}/{cost.pages} страниц</span>
                                <button onClick={() => handleUpgradeSkill(s.id)}
                                    disabled={pagesCount < cost.pages}
                                    className="ml-auto px-1.5 py-0.5 rounded bg-[var(--color-accent-gold)]/20 text-[var(--color-accent-gold)] border border-[var(--color-accent-gold)]/50 hover:bg-[var(--color-accent-gold)]/30 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                                    Улучшить ({cost.silver.toLocaleString()} серебра)
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
        </div>
    );
    };

    // renderStatus + renderPrepare in tabs when not in combat
    if (!inCombat && !claimed && !dead) {
        return (
            <div className="flex justify-center px-4 py-4">
                <div className="w-full max-w-3xl">
                <BackButton />
                <h1 className="text-xl font-bold mb-4 text-center">🏰 Подземелье</h1>
                {message && <p className="text-sm text-center mb-3 text-[var(--color-accent-warning)]">{message}</p>}

                <div className="flex gap-2 mb-4 justify-center">
                    <Button variant={tab === 'status' ? 'primary' : 'secondary'} size="md" onClick={() => setTab('status')}>⚔️ Вылазка</Button>
                    <Button variant={tab === 'prepare' ? 'primary' : 'secondary'} size="md" onClick={() => setTab('prepare')}>🔧 Подготовка</Button>
                </div>

                {tab === 'status' && status && renderStatus()}
                {tab === 'prepare' && renderPrepare()}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4 text-center">🏰 Подземелье</h1>
            {message && <p className="text-sm text-center mb-3 text-[var(--color-accent-warning)]">{message}</p>}

            {/* Награда */}
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
            {inCombat && !cleared && (
                <div className="space-y-3">
                    {/* Игрок */}
                    <Card>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-input)] border-2 border-[var(--color-accent-info)] flex items-center justify-center text-lg shrink-0 overflow-hidden">
                                {character?.avatar ? (
                                    <img src={character.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span>⚔️</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-bold">Этаж {floor}</span>
                                    <span className="text-xs">HP {playerHp}/{playerMaxHp}</span>
                                </div>
                                <div className="h-3 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-2">
                                    <div className="h-full rounded-full transition-all duration-300 ease-linear" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5">
                            <span>Автоатака ({attackSpeed} в сек.)</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all duration-200 ease-linear" style={{ width: `${Math.min(100, playerAttackProgress * 100)}%` }} />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-[var(--color-text-muted)]">Ярость</span>
                            <div className="flex-1 h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rage}%` }} />
                            </div>
                            <span className="text-xs font-bold text-red-400">{Math.round(rage)}</span>
                        </div>
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
                                <div key={e.id} onClick={() => handleTarget(e.id)}
                                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${isTarget ? 'border-[var(--color-accent-danger)] bg-[var(--color-accent-danger)]/10' : 'border-[var(--color-border-light)] bg-[var(--color-bg-card)]'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 font-bold text-white ${e.isBoss ? 'bg-[var(--color-accent-gold)] border-2 border-[var(--color-accent-gold)]' : 'border-2 border-[var(--color-border-light)]'}`}
                                            style={{ backgroundColor: e.isBoss ? undefined : stringToColor(e.name) }}>
                                            {e.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className={e.isBoss ? 'text-[var(--color-accent-gold)] font-bold' : ''}>
                                                    {isTarget && '🎯 '}{e.name}
                                                </span>
                                                <span>{e.hp}/{e.maxHp}</span>
                                            </div>
                                            <div className="h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-300 ease-linear"
                                                    style={{ width: `${Math.max(0, eHpPct)}%`, backgroundColor: eHpPct > 30 ? '#ef4444' : '#991b1b' }} />
                                            </div>
                                            <div className="h-1 bg-[var(--color-bg-input)] rounded-full overflow-hidden mt-1">
                                                <div className="flex justify-between text-[0.55rem] text-[var(--color-text-muted)] mb-0.5">
                                                    <span>Атака через 2.5 сек.</span>
                                                </div>
                                                <div className="h-full bg-[var(--color-accent-warning)] rounded-full transition-all duration-200 ease-linear" style={{ width: `${Math.min(100, (e.attackProgress || 0) * 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Умения — компактные иконки */}
                    <div className="grid grid-cols-4 gap-2">
                        {skills.map(s => {
                            const SKILL_ICONS_CBT: Record<number, string> = { 1: '🛡️', 2: '⚔️', 3: '📢', 4: '🩸', 5: '💀', 6: '😨', 7: '🏃', 8: '🌀' };
                            const onCd = cooldowns[s.id] && cooldowns[s.id] > Date.now() / 1000;
                            const cdLeft = onCd ? Math.ceil(cooldowns[s.id] - Date.now() / 1000) : 0;
                            const canUse = !onCd && rage >= s.rageCost;
                            return (
                                <button key={s.id} onClick={() => handleSkill(s.id)} disabled={!canUse}
                                    className={`relative p-2 rounded-lg text-center transition-colors cursor-pointer ${canUse
                                        ? 'bg-[var(--color-accent-info)]/20 border border-[var(--color-accent-info)] hover:bg-[var(--color-accent-info)]/30'
                                        : 'bg-[var(--color-bg-input)] border border-[var(--color-border-light)] opacity-60'}`}>
                                    <span className="text-xl">{SKILL_ICONS_CBT[s.id] || '❓'}</span>
                                    {onCd && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white bg-black/40 rounded-lg">{cdLeft}</span>}
                                    <div className="text-[0.55rem] text-[var(--color-text-muted)] mt-0.5 truncate">{s.nameRu}</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Лог боя */}
                    <Card>
                        <div ref={logRef} className="text-xs text-[var(--color-text-muted)] max-h-32 overflow-y-auto space-y-0.5">
                            {combatLog.map((l, i) => <div key={i}>{l}</div>)}
                            {combatLog.length === 0 && <div>Бой начинается...</div>}
                        </div>
                    </Card>

                    <Button variant="secondary" size="md" fullWidth onClick={handleFlee} disabled={loading}>🏃 Сбежать (награда потеряна)</Button>
                </div>
            )}

            {/* Комната после боя */}
            {inCombat && cleared && (
                <Card>
                    <h3 className="font-bold text-lg mb-3 text-center text-[var(--color-accent-success)]">🏆 Этаж {floor} пройден!</h3>

                    {/* Игрок: HP + ярость (продолжает снижаться) */}
                    <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span>HP {playerHp}/{playerMaxHp}</span>
                            <span className="text-red-400">Ярость {Math.round(rage)}</span>
                        </div>
                        <div className="h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                        </div>
                        <div className="h-1 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rage}%` }} />
                        </div>
                    </div>

                    {/* Лут (показывается, забирается при выходе) */}
                    <div className="bg-[var(--color-bg-input)] rounded-lg p-3 mb-3">
                        <h4 className="text-xs font-bold mb-2">📦 Добыча (забирается при выходе)</h4>
                        {claimResult ? (
                            <div className="space-y-1 text-xs">
                                <p>💰 Серебро: +{claimResult.silver.toLocaleString()}</p>
                                {claimResult.item && <p>🔮 {claimResult.item.name} ({claimResult.item.rarity})</p>}
                                {claimResult.page && <p>📜 Страница: {claimResult.page.name}</p>}
                                {claimResult.isBoss && <p className="text-[var(--color-accent-gold)]">⭐ Чекпоинт сохранён!</p>}
                            </div>
                        ) : (
                            <div className="text-xs text-center text-[var(--color-text-muted)]">
                                <Button variant="secondary" size="md" onClick={handleClaim} disabled={loading}>🎲 Открыть добычу</Button>
                            </div>
                        )}
                    </div>

                    {/* HP после отдыха */}
                    <p className="text-xs text-[var(--color-text-muted)] mb-3 text-center">
                        После отдыха: {claimResult ? claimResult.playerHp : playerHp} HP (+10% от максимума)
                    </p>

                    <div className="flex gap-2">
                        <Button variant="danger" size="md" onClick={handleContinue} className="flex-1">
                            ➡ Этаж {claimResult?.nextFloor || floor + 1}
                        </Button>
                        <Button variant="secondary" size="md" onClick={() => { setExited(true); stopPolling(); }}>
                            🚪 Выйти
                        </Button>
                    </div>
                </Card>
            )}

            {/* Выход с добычей */}
            {exited && claimResult && (
                <Card>
                    <h3 className="font-bold text-lg mb-3 text-center text-[var(--color-accent-success)]">🏆 Подземелье пройдено!</h3>
                    <div className="bg-[var(--color-bg-input)] rounded-lg p-3 mb-3">
                        <h4 className="text-xs font-bold mb-2">📦 Добыча:</h4>
                        <div className="space-y-1 text-sm">
                            <p>💰 Серебро: +{claimResult.silver.toLocaleString()}</p>
                            {claimResult.item && <p>🔮 {claimResult.item.name} ({claimResult.item.rarity})</p>}
                            {claimResult.page && <p>📜 Страница: {claimResult.page.name}</p>}
                            {claimResult.isBoss && <p className="text-[var(--color-accent-gold)]">⭐ Чекпоинт сохранён!</p>}
                        </div>
                    </div>
                    <Button variant="danger" size="md" fullWidth onClick={() => { setExited(false); setCleared(false); setClaimed(false); setInCombat(false); loadStatus(); }}>
                        Продолжить
                    </Button>
                </Card>
            )}
        </div>
    );
}

const SKILLS_ALL = [
    { id: 1, name: 'shield_bash', nameRu: 'Удар щитом', rageCost: 5, rageGain: 0, cooldown: 6, desc: 'Оглушение', descScale: '+0.2с стана, +10% урона' },
    { id: 2, name: 'sweep', nameRu: 'Размах', rageCost: 15, rageGain: 0, cooldown: 5, desc: 'AoE 3 цели', descScale: '+10% урона' },
    { id: 3, name: 'battle_cry', nameRu: 'Боевой клич', rageCost: 20, rageGain: 0, cooldown: 20, desc: '+20% урона', descScale: '+5% урона, +1с' },
    { id: 4, name: 'rend', nameRu: 'Раздирание', rageCost: 10, rageGain: 0, cooldown: 0, desc: 'Кровотечение 9с', descScale: '+5% урона за тик' },
    { id: 5, name: 'execute', nameRu: 'Добивание', rageCost: 30, rageGain: 0, cooldown: 8, desc: '<30% HP', descScale: '+25% урона' },
    { id: 6, name: 'demoralize', nameRu: 'Деморализация', rageCost: 10, rageGain: 0, cooldown: 25, desc: '-10% урона врагу', descScale: '-2% урона, +2с' },
    { id: 7, name: 'charge', nameRu: 'Рывок', rageCost: 0, rageGain: 12, cooldown: 15, desc: 'Стан 1с', descScale: '+0.2с стана, +3 ярости' },
    { id: 8, name: 'whirlwind', nameRu: 'Вихрь', rageCost: 25, rageGain: 0, cooldown: 10, desc: 'Все враги', descScale: '+10% урона' },
];
