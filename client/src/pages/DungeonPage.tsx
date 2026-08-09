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
    image?: string; attackInterval?: number; stunned?: boolean; lastAttackAt?: number; stunLeft?: number;
}

interface SkillInfo {
    id: number; name: string; nameRu: string; rageCost: number; rageGain: number; cooldown: number;
    desc: string; descScale: string; level?: number; icon: string;
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
    const [regenRate, setRegenRate] = useState(1);
    const [buffs, setBuffs] = useState<any[]>([]);
    const [cooldowns, setCooldowns] = useState<Record<number, number>>({});
    const [combatLog, setCombatLog] = useState<string[]>([]);
    const [attackSpeed, setAttackSpeed] = useState('0');
    const [selectedSkills, setSelectedSkills] = useState<number[]>([7, 2, 3, 1]);
    const [cleared, setCleared] = useState(false);
    const [dead, setDead] = useState(false);
    const [exited, setExited] = useState(false);
    const [targetIndex, setTargetIndex] = useState(0);
    const [playerLastAttackAt, setPlayerLastAttackAt] = useState(0);
    const [playerAtkInterval, setPlayerAtkInterval] = useState(1);
    const [claimed, setClaimed] = useState(false);
    const [claimResult, setClaimResult] = useState<any>(null);
    const [pages, setPages] = useState<any[]>([]);
    const [totalLoot, setTotalLoot] = useState<{ silver: number; items: string[]; pages: string[] }>({ silver: 0, items: [], pages: [] });
    const [looting, setLooting] = useState(false);
    const [lootProgress, setLootProgress] = useState(0);

    const [skillList, setSkillList] = useState<SkillInfo[]>([]);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const floatIdRef = useRef(0);

    // Плавающий текст урона и эффектов
    interface FloatText { id: number; text: string; color: string; enemyIndex?: number; }
    const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);

    const addFloats = (logLines: string[], currentEnemies: EnemyView[]) => {
        const floats: FloatText[] = [];
        for (const line of logLines) {
            const id = ++floatIdRef.current;
            // Урон врагу — ищем имя врага в строке
            const dmgMatch = line.match(/^[⚔️💥⚡↔🌀💀🩸]\s*.*?(\d+)\s*(урона|по|\(блок\))\s*(.+)/);
            if (dmgMatch) {
                const enemyName = dmgMatch[3]?.trim();
                const enemyIdx = currentEnemies.findIndex(e => e.name === enemyName);
                floats.push({ id, text: dmgMatch[1], color: line.includes('Крит') ? '#ffaa00' : '#ffffff', enemyIndex: enemyIdx >= 0 ? enemyIdx : undefined });
            }
            // Крит эффект — на того же врага что и урон
            if (line.includes('Крит')) {
                const critEnemy = floats.find(f => f.color === '#ffaa00' && f.enemyIndex !== undefined);
                floats.push({ id: ++floatIdRef.current, text: 'Крит!', color: '#ffaa00', enemyIndex: critEnemy?.enemyIndex });
            }
            // Оглушение — на текущую цель
            if (line.includes('оглушение')) {
                floats.push({ id: ++floatIdRef.current, text: 'Оглушение!', color: '#fbbf24', enemyIndex: targetIndex });
            }
            // Уклонение врага
            if (line.match(/^↗.*уклоняется/)) {
                const enemyName = line.replace(/^↗\s*/, '').replace(' уклоняется', '').trim();
                const enemyIdx = currentEnemies.findIndex(e => e.name === enemyName);
                if (enemyIdx >= 0) floats.push({ id: ++floatIdRef.current, text: 'Уклонение!', color: '#60a5fa', enemyIndex: enemyIdx });
            }
            // Уклонение / блок игрока
            if (line.includes('Вы уклоняетесь')) {
                floats.push({ id, text: 'Уклонение!', color: '#60a5fa' });
            }
            if (line.includes('Блок!')) {
                floats.push({ id, text: 'Блок!', color: '#818cf8' });
            }
            // Урон игроку
            const hitMatch = line.match(/👊.*бьёт на (\d+)/);
            if (hitMatch) {
                floats.push({ id, text: hitMatch[1], color: '#ef4444' });
            }
            // Ярость
            const rageMatch = line.match(/🏃.*\+(\d+)\s*ярости/);
            if (rageMatch) {
                floats.push({ id, text: `+${rageMatch[1]} ярости`, color: '#f97316' });
            }
        }
        if (floats.length > 0) {
            setFloatTexts(prev => [...prev, ...floats]);
            setTimeout(() => {
                setFloatTexts(prev => prev.filter(f => !floats.some(nf => nf.id === f.id)));
            }, 1500);
        }
    };

    useEffect(() => { loadStatus(); loadPages(); loadSkills(); }, []);

    // Локальный тик для плавных прогресс-баров
    const [frameTick, setFrameTick] = useState(0);
    const [leaderboard, setLeaderboard] = useState<{ topFloor: any[]; topReward: any[] }>({ topFloor: [], topReward: [] });
    const [showAllFloors, setShowAllFloors] = useState(false);
    useEffect(() => {
        if (!inCombat) return;
        const iv = setInterval(() => setFrameTick(t => t + 1), 50);
        return () => clearInterval(iv);
    }, [inCombat]);

    const loadSkills = async () => {
        try {
            const res = await fetch('/api/dungeon/skills', { headers: getHeaders() });
            const data = await res.json();
            setSkillList(data.skills || []);
        } catch { /* */ }
    };

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
                setRage(Math.round(data.rage || 0));
                setRegenRate(data.regenRate || 1);
                if (data.cleared) setCleared(true);
                startPolling();
            }
            // Рейтинг
            try {
                const lb = await fetch('/api/dungeon/leaderboard', { headers: getHeaders() });
                setLeaderboard(await lb.json());
            } catch { /* */ }
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
                setRage(Math.round(data.rage || 0));
                setRegenRate(data.regenRate || 1);
                setBuffs(data.buffs || []);
                setCooldowns(data.skillCooldowns || {});
                setAttackSpeed(data.attackSpeed || '0');
                if (data.cleared) { setCleared(true); /* НЕ останавливаем опрос — реген */ }
                if (data.dead) { setDead(true); setInCombat(false); stopPolling(); }
                setTargetIndex(data.targetIndex ?? 0);
                setPlayerLastAttackAt(data.lastPlayerAttackAt || 0);
                setPlayerAtkInterval(data.playerAttackInterval || 1);
                if (data.log?.length) { setCombatLog(prev => [...prev, ...data.log].slice(-50)); addFloats(data.log, data.enemies || []); }
            } catch { /* */ }
        }, 500);
    };

    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    useEffect(() => { return () => stopPolling(); }, []);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [combatLog]);

    // Получить список доступных чекпоинтов (кратные 5)
    const getCheckpoints = () => {
        const maxFloor = status?.checkpointFloor || 0;
        const points: number[] = [1]; // этаж 1 всегда доступен
        for (let f = 6; f <= maxFloor; f += 5) points.push(f);
        return points.reverse(); // высший этаж первым
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
            setCleared(false); setClaimed(false); setClaimResult(null); setLooting(false); setLootProgress(0);
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

    // Авто-лут после зачистки этажа (лут показывается, но не выдаётся до выхода)
    useEffect(() => {
        if (!cleared || !inCombat || looting || claimed) return;
        setLooting(true);
        const corpseCount = enemies.length || 1;
        let progress = 0;
        const tick = 50;
        const totalTicks = (corpseCount * 1000) / tick;
        const interval = setInterval(() => {
            progress += 1;
            setLootProgress(Math.min(100, (progress / totalTicks) * 100));
            if (progress >= totalTicks) {
                clearInterval(interval);
                handleClaim();
            }
        }, tick);
        return () => clearInterval(interval);
    }, [cleared, inCombat]);

    const handleClaim = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/claim', { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setClaimed(true); setClaimResult(data); setPlayerHp(data.playerHp);
            setTotalLoot(prev => ({
                silver: prev.silver + (data.silver || 0),
                items: data.item ? [...prev.items, `${data.item.name} (${data.item.rarity})`] : prev.items,
                pages: data.page ? [...prev.pages, data.page.name] : prev.pages,
            }));
            if (data.isBoss) setMessage('⭐ Чекпоинт сохранён!');
        } catch (e: any) { setMessage(e.message); }
        finally { setLoading(false); }
    };

    const handleTarget = async (enemyId: number) => {
        try {
            await fetch('/api/dungeon/target', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ enemyId }) });
        } catch { /* */ }
    };

    const handleFlee = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dungeon/flee', { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            if (data.loot) {
                setTotalLoot({ silver: data.loot.silver, items: data.loot.items.map((it: any) => `${it.name} (${it.rarity})`), pages: data.loot.pages.map((p: any) => p.name) });
            }
            setInCombat(false); stopPolling(); loadStatus();
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
                {status?.cooldownRemaining > 0 && (
                    <span className="text-[var(--color-text-muted)]">Кулдаун: {Math.floor(status.cooldownRemaining / 60)}м {status.cooldownRemaining % 60}с</span>
                )}
            </p>

            <h3 className="text-sm font-bold mb-2">Выбор этажа:</h3>
            <div className="space-y-2 mb-4">
                {(() => {
                    const allCP = getCheckpoints();
                    const visible = showAllFloors ? allCP : allCP.slice(0, 5);
                    return (
                        <>
                            {visible.map(cp => (
                                <div key={cp} className={`p-3 rounded-lg border cursor-pointer transition-colors ${cp === 1 || (cp - 1) % 5 === 0
                                    ? 'border-[var(--color-border-light)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-info)]'
                                    : 'opacity-50'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold">
                                            {cp === 1 ? 'Этаж 1' : `Этаж ${cp}`}
                                        </span>
                                        <Button variant="danger" size="md"
                                            onClick={() => handleStart(cp)}
                                            disabled={loading || status?.remainingRuns <= 0 || status?.cooldownRemaining > 0}>
                                            🗡️ В бой
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {allCP.length > 5 && !showAllFloors && (
                                <Button variant="secondary" size="sm" fullWidth onClick={() => setShowAllFloors(true)}>
                                    Ещё ({allCP.length - 5})
                                </Button>
                            )}
                        </>
                    );
                })()}
            </div>

            {(leaderboard.topFloor.length > 0 || leaderboard.topReward.length > 0) && (
                <div className="border-t border-[var(--color-border-light)] pt-3 mt-3">
                    <div className="flex flex-col md:flex-row gap-3">
                    {leaderboard.topFloor.length > 0 && (
                        <div className="md:w-1/2">
                            <h4 className="text-xs font-bold mb-1">🏆 Рейтинг этажа</h4>
                            {leaderboard.topFloor.map((r: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs py-0.5">
                                    <span>{i+1}. {r.username}</span>
                                    <span className="text-[#8b6914] dark:text-[var(--color-accent-gold)]">Этаж {r.maxfloor}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {leaderboard.topReward.length > 0 && (
                        <div className="md:w-1/2">
                            <h4 className="text-xs font-bold mb-1">💰 Рейтинг награды</h4>
                            {leaderboard.topReward.map((r: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs py-0.5">
                                    <span>{i+1}. {r.username}</span>
                                    <span className="text-[#8b6914] dark:text-[var(--color-accent-gold)]">{r.maxreward.toLocaleString()} серебра</span>
                                </div>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            )}
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
                    const skill = sid ? skillList.find(s => s.id === sid) : null;
                    return (
                        <div key={i} className={`p-2 rounded-lg border text-center min-h-[60px] flex flex-col items-center justify-center ${skill
                            ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/10'
                            : 'border-dashed border-[var(--color-border-light)] bg-[var(--color-bg-input)]'}`}>
                            {skill ? (
                                <>
                                    <span className="text-lg">{skill.icon || '❓'}</span>
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
                {skillList.map(s => {
                    const level = getSkillLevel(s.id);
                    const pagesCount = getPageCount(s.id);
                    const cost = getUpgradeCost(s.id);
                    const selected = selectedSkills.includes(s.id);
                    const canSelect = level >= 1;

                    return (
                        <div key={s.id} className={`p-3 rounded-lg border ${selected ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/10' : 'border-[var(--color-border-light)] bg-[var(--color-bg-card)]'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <span className="text-lg mr-1">{s.icon || '❓'}</span>
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
                                    className="ml-auto px-1.5 py-0.5 rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] hover:border-[var(--color-accent-gold)] disabled:opacity-40 cursor-pointer disabled:cursor-default">
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
    if (!inCombat && !claimed && !dead && !exited) {
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

            {/* Смерть */}
            {dead && playerHp <= 0 && (
                <Card>
                    <h3 className="font-bold text-lg mb-2 text-center text-[var(--color-accent-danger)]">💀 Вы погибли</h3>
                    <p className="text-sm text-center mb-3">Награда потеряна.</p>
                    <Button variant="secondary" size="md" fullWidth onClick={() => { setDead(false); setInCombat(false); stopPolling(); loadStatus(); }}>
                        Вернуться
                    </Button>
                </Card>
            )}

            {/* Бой */}
            {inCombat && !cleared && playerHp > 0 && (
                <div className="space-y-3 relative">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Левая колонка: игрок + умения */}
                        <div className="md:w-1/2 space-y-3">
                    {/* Игрок */}
                    <Card>
                        <div className="relative">
                        {/* Плавающий текст по игроку */}
                        {floatTexts.filter(ft => ft.enemyIndex === undefined).map(ft => (
                            <span key={ft.id} className="absolute pointer-events-none font-bold text-sm z-20 right-4"
                                style={{ color: ft.color, top: '-10px', animation: 'floatUp 1.5s ease-out forwards', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                                {ft.text}
                            </span>
                        ))}
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-input)] border-2 border-[var(--color-accent-info)] flex items-center justify-center text-lg shrink-0 overflow-hidden">
                                {character?.avatar ? (
                                    <img src={character.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span>⚔️</span>
                                )}
                            </div>
                            {/* Автоатака */}
                            {(() => { void frameTick; const cdLeft = Math.max(0, Math.ceil(((playerLastAttackAt + playerAtkInterval * 3) - Date.now() / 1000))); return (
                                <div className="relative w-10 h-10 rounded-full bg-[var(--color-accent-warning)]/10 border-2 border-[var(--color-accent-warning)] flex items-center justify-center text-lg shrink-0">
                                    <span>⚔️</span>
                                    {cdLeft > 0 && <span className="absolute inset-0 flex items-center justify-center text-[0.6rem] font-bold text-white bg-black/40 rounded-full">{cdLeft}</span>}
                                </div>
                            ); })()}
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
                                        {skillList.find(s => s.name === b.id)?.nameRu || b.id} {Math.ceil(b.endsAt - Date.now() / 1000)}с
                                    </span>
                                ))}
                            </div>
                        )}
                        </div>
                    </Card>

                    {/* Умения */}
                    <div className="grid grid-cols-4 gap-2">
                        {skills.map(s => {
                            const onCd = cooldowns[s.id] && cooldowns[s.id] > Date.now() / 1000;
                            const cdLeft = onCd ? Math.ceil(cooldowns[s.id] - Date.now() / 1000) : 0;
                            const canUse = !onCd && rage >= s.rageCost;
                            return (
                                <button key={s.id} onClick={() => handleSkill(s.id)} disabled={!canUse}
                                    className={`relative p-2 rounded-lg text-center transition-colors cursor-pointer ${canUse
                                        ? 'bg-[var(--color-accent-info)]/20 border border-[var(--color-accent-info)] hover:bg-[var(--color-accent-info)]/30'
                                        : 'bg-[var(--color-bg-input)] border border-[var(--color-border-light)] opacity-60'}`}>
                                    <span className="text-xl">{s.icon || '❓'}</span>
                                    {onCd && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white bg-black/40 rounded-lg">{cdLeft}</span>}
                                    <div className="text-[0.55rem] text-[var(--color-text-muted)] mt-0.5 truncate">{s.nameRu}</div>
                                </button>
                            );
                        })}
                    </div>

                        </div>
                        {/* Правая колонка: враги */}
                        <div className="md:w-1/2">
                    {/* Враги */}
                    <div className="space-y-2">
                        {enemies.map((e, i) => {
                            const eHpPct = e.maxHp > 0 ? (e.hp / e.maxHp) * 100 : 0;
                            const isTarget = i === targetIndex;
                            const isDead = e.hp <= 0;
                            return (
                                <div key={e.id} onClick={() => !isDead && handleTarget(e.id)}
                                    className={`p-2 rounded-lg border transition-colors relative ${isDead ? 'opacity-40 grayscale border-[var(--color-border-light)] bg-[var(--color-bg-card)]' : isTarget ? 'border-[var(--color-accent-danger)] bg-[var(--color-accent-danger)]/10 cursor-pointer' : 'border-[var(--color-border-light)] bg-[var(--color-bg-card)] cursor-pointer'}`}>
                                    {/* Плавающий текст по этому врагу */}
                                    {floatTexts.filter(ft => ft.enemyIndex === i).map(ft => (
                                        <span key={ft.id} className="absolute pointer-events-none font-bold text-sm z-20 left-1/2 -translate-x-1/2"
                                            style={{ color: ft.color, top: '-12px', animation: 'floatUp 1.5s ease-out forwards', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                                            {ft.text}
                                        </span>
                                    ))}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 overflow-hidden font-bold text-white ${e.isBoss ? 'border-2 border-[var(--color-accent-gold)]' : 'border-2 border-[var(--color-border-light)]'}`}
                                            style={{ backgroundColor: e.image ? undefined : stringToColor(e.name) }}>
                                            {e.image ? <img src={e.image} alt="" className="w-full h-full object-cover" /> : e.name.charAt(0)}
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
                                            {!isDead && !e.stunned && (
                                            <div className="flex items-center gap-1 mt-1">
                                                {(() => { void frameTick; const cdLeft = Math.max(0, Math.ceil(((e.lastAttackAt || 0) + (e.attackInterval || 2.5) * 3 - Date.now() / 1000))); return (
                                                    <div className="relative w-6 h-6 rounded-full bg-[var(--color-bg-input)] flex items-center justify-center text-xs shrink-0">
                                                        <span>⚔️</span>
                                                        {cdLeft > 0 && <span className="absolute inset-0 flex items-center justify-center text-[0.5rem] font-bold text-white bg-black/40 rounded-full">{cdLeft}</span>}
                                                    </div>
                                                ); })()}
                                                <span className="text-[0.55rem] text-[var(--color-text-muted)]">Атака</span>
                                            </div>
                                            )}
                                            {!isDead && e.stunned && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="relative w-6 h-6 rounded-full bg-[var(--color-bg-input)] border border-[var(--color-border-light)] flex items-center justify-center text-xs shrink-0">
                                                    <span>⚡</span>
                                                    <span className="absolute inset-0 flex items-center justify-center text-[0.5rem] font-bold text-white bg-black/40 rounded-full">{Math.ceil(e.stunLeft || 0)}</span>
                                                </div>
                                                <span className="text-[0.55rem] text-[var(--color-accent-warning)]">Оглушение</span>
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                        </div>
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

                    {/* Игрок: HP + ярость */}
                    <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span>HP {playerHp}/{playerMaxHp}</span>
                            <span className="text-[var(--color-text-muted)]">
                                {playerHp < playerMaxHp ? `⏳ полное через ${Math.ceil((playerMaxHp - playerHp) / (playerMaxHp * 0.03 * regenRate))}с` : '✅ HP полное'}
                            </span>
                        </div>
                        <div className="h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                        </div>
                        <div className="h-1 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rage}%` }} />
                        </div>
                    </div>

                    {/* Обыск трупов или лут */}
                    {!claimed && looting && (
                        <div className="bg-[var(--color-bg-input)] rounded-lg p-3 mb-3">
                            <p className="text-xs text-center mb-2">🔍 Обыск трупов...</p>
                            <div className="h-2 bg-[var(--color-bg-card)] rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all duration-100 ease-linear" style={{ width: `${lootProgress}%` }} />
                            </div>
                        </div>
                    )}
                    {claimed && claimResult && (
                        <>
                            {/* Лут с этажа */}
                            <div className="bg-[var(--color-bg-input)] rounded-lg p-3 mb-1">
                                <p className="text-xs font-bold mb-1">🔍 Собрано с этажа {floor}:</p>
                                <p className="text-xs">💰 Серебро: +{claimResult.silver.toLocaleString()}</p>
                                {claimResult.item && <p className="text-xs">🔮 {claimResult.item.name} ({claimResult.item.rarity})</p>}
                                {claimResult.page && <p className="text-xs">📜 Страница: {claimResult.page.name}</p>}
                                {claimResult.isBoss && <p className="text-xs text-[var(--color-accent-gold)]">⭐ Чекпоинт сохранён!</p>}
                            </div>
                            {/* Весь лут за поход */}
                            <div className="bg-[var(--color-bg-card)] rounded-lg p-3 mb-3">
                                <h4 className="text-xs font-bold mb-1">📦 Вся добыча за поход:</h4>
                                <p className="text-xs">💰 {totalLoot.silver.toLocaleString()} серебра</p>
                                {totalLoot.items.map((it, i) => <p key={i} className="text-xs">🔮 {it}</p>)}
                                {totalLoot.pages.map((p, i) => <p key={i} className="text-xs">📜 {p}</p>)}
                            </div>
                            <p className="text-[0.6rem] text-[var(--color-accent-danger)] text-center mb-2">⚠ При смерти вся накопленная добыча будет потеряна</p>
                        </>
                    )}

                    <div className="flex gap-2">
                        <Button variant="danger" size="md" onClick={handleContinue} className="flex-1" disabled={!claimed || loading}>
                            ➡ Этаж {claimResult?.nextFloor || floor + 1}
                        </Button>
                        <Button variant="secondary" size="md" onClick={() => { setExited(true); setCleared(false); setClaimed(false); setLooting(false); setLootProgress(0); setInCombat(false); stopPolling(); }}>
                            🚪 Выйти
                        </Button>
                    </div>
                </Card>
            )}

            {/* Выход — итоги похода */}
            {exited && (
                <Card>
                    <h3 className="font-bold text-lg mb-3 text-center text-[var(--color-accent-success)]">🚪 Вы покидаете подземелье</h3>
                    <div className="bg-[var(--color-bg-card)] rounded-lg p-3 mb-3">
                        <h4 className="text-xs font-bold mb-1">📦 Добыча за поход:</h4>
                        <p className="text-xs">💰 {totalLoot.silver.toLocaleString()} серебра</p>
                        {totalLoot.items.map((it, i) => <p key={i} className="text-xs">🔮 {it}</p>)}
                        {totalLoot.pages.map((p, i) => <p key={i} className="text-xs">📜 {p}</p>)}
                        {totalLoot.silver === 0 && totalLoot.items.length === 0 && totalLoot.pages.length === 0 && (
                            <p className="text-xs text-[var(--color-text-muted)]">Ничего не собрано</p>
                        )}
                    </div>
                    <Button variant="primary" size="md" fullWidth onClick={() => { setExited(false); setTotalLoot({ silver: 0, items: [], pages: [] }); handleFlee(); }}>
                        Покинуть подземелье
                    </Button>
                </Card>
            )}

            {/* Выход — без отдельного экрана, просто возврат */}
        </div>
    );
}
