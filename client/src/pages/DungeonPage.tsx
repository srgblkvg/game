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
}

interface SkillInfo {
    id: number; name: string; nameRu: string; rageCost: number; rageGain: number; cooldown: number;
    desc: string; descScale: string; level: number;
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
    const [selectedSkills, setSelectedSkills] = useState<number[]>([1, 2, 3]);
    const [cleared, setCleared] = useState(false);
    const [dead, setDead] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [claimResult, setClaimResult] = useState<any>(null);
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
                if (data.cleared) { setCleared(true); stopPolling(); }
                if (data.dead) { setDead(true); setInCombat(false); stopPolling(); }
                if (data.log?.length) setCombatLog(prev => [...prev, ...data.log].slice(-50));
            } catch { /* */ }
        }, 500);
    };

    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    useEffect(() => { return () => stopPolling(); }, []);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [combatLog]);

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
                headers: getHeaders(),
                body: JSON.stringify({ slot }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.character) setCharacter(data.character);
            }
        } catch { /* */ }
    };

    // Вкладка Подготовка — умения
    const renderPrepare = () => {
        const equipSets = (character as any)?.equipment1 !== undefined ? {
            1: (character as any).equipment1,
            2: (character as any).equipment2,
            3: (character as any).equipment3,
        } : undefined;
        const activeSlot = (character as any)?.activeEquipSlot || 1;

        const SKILL_ICONS: Record<number, string> = {
            1: '🛡️', 2: '⚔️', 3: '📢', 4: '🩸', 5: '💀', 6: '😨', 7: '🏃', 8: '🌀',
        };

        return (
        <div className="max-w-3xl mx-auto">
            <div className="md:flex md:gap-8 md:items-start space-y-4 md:space-y-0">
            <div className="md:w-[220px] md:shrink-0 mx-auto md:mx-0">
                {character && (
                    <CharacterCard
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
        </div>
    );
    };

    // renderStatus + renderPrepare in tabs when not in combat
    if (!inCombat && !claimed && !dead) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-4">
                <BackButton />
                <h1 className="text-xl font-bold mb-4 text-center">🏰 Подземелье</h1>
                {message && <p className="text-sm text-center mb-3 text-[var(--color-accent-warning)]">{message}</p>}

                <div className="flex gap-2 mb-4">
                    <Button variant={tab === 'status' ? 'primary' : 'secondary'} size="md" onClick={() => setTab('status')}>⚔️ Вылазка</Button>
                    <Button variant={tab === 'prepare' ? 'primary' : 'secondary'} size="md" onClick={() => setTab('prepare')}>🔧 Подготовка</Button>
                </div>

                {tab === 'status' && status && renderStatus()}
                {tab === 'prepare' && renderPrepare()}
            </div>
        );
    }

    return (
        <div className="mx-auto px-4 py-4">
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
            {inCombat && (
                <div className="space-y-3">
                    <Card>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold">Этаж {floor}</span>
                            <span className="text-xs">HP {playerHp}/{playerMaxHp}</span>
                        </div>
                        <div className="h-3 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-[var(--color-text-muted)]">Ярость</span>
                            <div className="flex-1 h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rage}%` }} />
                            </div>
                            <span className="text-xs font-bold text-red-400">{rage}</span>
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
                    </div>

                    {/* Умения */}
                    <div className="grid grid-cols-2 gap-2">
                        {skills.map(s => {
                            const SKILL_ICONS_CBT: Record<number, string> = {
                                1: '🛡️', 2: '⚔️', 3: '📢', 4: '🩸', 5: '💀', 6: '😨', 7: '🏃', 8: '🌀',
                            };
                            const onCd = cooldowns[s.id] && cooldowns[s.id] > Date.now() / 1000;
                            const cdLeft = onCd ? Math.ceil(cooldowns[s.id] - Date.now() / 1000) : 0;
                            const canUse = !onCd && rage >= s.rageCost && !cleared;
                            return (
                                <button key={s.id} onClick={() => handleSkill(s.id)} disabled={!canUse}
                                    className={`p-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${canUse
                                        ? 'bg-[var(--color-accent-info)]/20 border border-[var(--color-accent-info)] hover:bg-[var(--color-accent-info)]/30 text-[var(--color-text-primary)]'
                                        : 'bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-[var(--color-text-muted)] opacity-60'}`}>
                                    <div className="font-bold">{SKILL_ICONS_CBT[s.id] || ''} {s.nameRu} {s.level > 0 && `+${s.level}`}</div>
                                    <div className="text-[0.6rem]">{onCd ? `⏳ ${cdLeft}с` : s.rageCost > 0 ? `${s.rageCost} ярости` : `+${s.rageGain} ярости`}</div>
                                    <div className="text-[0.6rem] text-[var(--color-text-muted)]">{s.desc}</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Лог */}
                    <Card>
                        <div ref={logRef} className="text-xs text-[var(--color-text-muted)] max-h-32 overflow-y-auto space-y-0.5">
                            {combatLog.map((l, i) => <div key={i}>{l}</div>)}
                            {combatLog.length === 0 && <div>Бой начинается...</div>}
                        </div>
                    </Card>

                    {cleared && (
                        <div className="flex gap-2">
                            <Button variant="danger" size="md" onClick={handleClaim} disabled={loading}>🏆 Забрать награду</Button>
                            <Button variant="secondary" size="md" onClick={handleFlee} disabled={loading}>🏃 Сбежать</Button>
                        </div>
                    )}
                    {!cleared && (
                        <Button variant="secondary" size="md" fullWidth onClick={handleFlee} disabled={loading}>🏃 Сбежать (потеря лута)</Button>
                    )}
                </div>
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
