import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { fetchMobs, attackMob } from '../api/mobs';
import { fetchCharacter } from '../api/character';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useServerTime, getRemaining } from '../hooks/useServerTime';
import { useAcquire } from '../contexts/AcquireContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { renderBattleLog } from '../utils/battleLog';
import { formatMoney } from '../utils/money';
import { calculateStats } from '../utils/stats';
import CharacterCard from '../components/CharacterCard';
import ItemTooltip from '../components/ItemTooltip';

const rarityColors: Record<number, string> = {
  0: '#6b6b6b', 1: '#a0a0a0', 2: '#4a9b4a', 3: '#4a7ac0', 4: '#a040c0', 5: '#d4a020', 6: '#e03030',
};
const rarityNames: Record<number, string> = {
  0: 'Хлам', 1: 'Обычный', 2: 'Необычный', 3: 'Редкий', 4: 'Эпический', 5: 'Легендарный', 6: 'Мифический',
};
const rarityTextColors: Record<number, string> = {
  0: 'text-[#6b6b6b]', 1: 'text-[#a0a0a0]', 2: 'text-[#4a9b4a]', 3: 'text-[#4a7ac0]', 4: 'text-[#a040c0]', 5: 'text-[#d4a020]', 6: 'text-[#e03030]',
};

export default function BestiaryPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const serverTime = useServerTime();
  const navigate = useNavigate();
  const { showAcquire } = useAcquire();

  const [phase, setPhase] = useState<'floors' | 'battle'>('floors');
  const [mobs, setMobs] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedMob, setSelectedMob] = useState<any>(null);
  const [battleSteps, setBattleSteps] = useState<any[]>([]);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [playerHp, setPlayerHp] = useState(0);
  const [mobHp, setMobHp] = useState(0);
  const [playerMaxHp, setPlayerMaxHp] = useState(0);
  const [mobMaxHp, setMobMaxHp] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [speed, setSpeed] = useState(1);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isVerySmall, setIsVerySmall] = useState(window.innerWidth < 420);
  const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);

  const timerRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stepLock = useRef(false);
  const stepsRef = useRef<any[]>([]);
  const currentStepRef = useRef(-1);
  const speedRef = useRef(1);
  const initialHpRef = useRef({ player: 0, mob: 0 });

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { stepsRef.current = battleSteps; }, [battleSteps]);
  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);
  useEffect(() => { if (character?.activeJob) navigate('/jobs'); }, [character?.activeJob, navigate]);
  useEffect(() => { loadMobs(); updateCooldown(); }, []);
  useEffect(() => {
    const handler = () => { setIsMobile(window.innerWidth < 600); setIsVerySmall(window.innerWidth < 420); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const updateCooldown = useCallback(() => {
    const remaining = (character as any)?.pveCooldownSec ?? getRemaining(((character as any)?.lastPveAttackTime || 0) + 300);
    setCooldownRemaining(remaining);
    if (cooldownTimerRef.current) { clearInterval(cooldownTimerRef.current); cooldownTimerRef.current = null; }
    if (remaining > 0) {
      cooldownTimerRef.current = window.setInterval(() => {
        setCooldownRemaining(prev => {
          const next = Math.max(0, prev - 1);
          if (next <= 0 && cooldownTimerRef.current) { clearInterval(cooldownTimerRef.current!); cooldownTimerRef.current = null; }
          return next;
        });
      }, 1000);
    }
  }, [character, serverTime]);

  useEffect(() => { return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); }; }, []);

  const loadMobs = async () => {
    try { setMobs(await fetchMobs()); } catch (e: any) { setError(e.message); }
  };

  // API returns mobs in level order — just deduplicate, no sort needed
  const [floorsData, setFloorsData] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/floors')
      .then(r => r.json()).then(setFloorsData).catch(() => {});
  }, []);

  const floorBgMap = new Map(floorsData.map((f: any) => [f.name, f.background]));
  // Build floor list in mob order (by level), with backgrounds from floors table
  const mobFloorNames: string[] = [];
  const seen = new Set<string>();
  for (const m of mobs) {
    if (!seen.has(m.location)) {
      seen.add(m.location);
      mobFloorNames.push(m.location);
    }
  }
  const floors = mobFloorNames;

  const getFloorInfo = (floor: string) => {
    const fm = mobs.filter((m: any) => m.location === floor).sort((a: any, b: any) => a.level - b.level);
    const goldMin = fm.reduce((min, m) => Math.min(min, m.gold_min), Infinity);
    const goldMax = fm.reduce((max, m) => Math.max(max, m.gold_max), 0);
    const avgXp = fm.length > 0 ? Math.round(fm.reduce((s, m) => s + (m.xp || 0), 0) / fm.length) : 0;
    // Лут: собираем изображения и макс. шансы по редкостям
    const lootImages: { rarity: number; name: string; image: string; chance: number }[] = [];
    const seenRarities = new Set<number>();
    for (const m of fm) {
      if (m.lootImages) {
        for (const li of m.lootImages) {
          if (!seenRarities.has(li.rarity)) {
            seenRarities.add(li.rarity);
            lootImages.push(li);
          }
        }
      }
    }
    // Предметы: собираем таблицу дропа по этажу (макс шанс по каждой редкости)
    const itemDropMap = new Map<number, number>();
    for (const m of fm) {
        if (m.itemDropTable) {
            for (const it of m.itemDropTable) {
                const prev = itemDropMap.get(it.rarity);
                if (!prev || it.chance > prev) {
                    itemDropMap.set(it.rarity, it.chance);
                }
            }
        }
    }
    const itemDropTable = Array.from(itemDropMap.entries()).map(([rarity, chance]) => ({ rarity, chance }));
    return { count: fm.length, minLevel: fm[0]?.level || 0, maxLevel: fm[fm.length - 1]?.level || 0, goldMin, goldMax, avgXp, lootImages, itemDropTable };
  };

  // --- Animation helpers (same as useBattleLogic) ---
  const showEffectText = (side: 'left' | 'right', text: string, color = '#f1c40f') => {
    const overlay = document.getElementById(`effect-${side}`);
    if (!overlay) return;
    overlay.textContent = text;
    overlay.style.color = color;
    overlay.classList.add('show');
    overlay.addEventListener('animationend', () => overlay.classList.remove('show'), { once: true });
  };

  const showDamageNumber = (side: 'left' | 'right', dmg: number) => {
    const card = document.getElementById(`fighter-${side}`);
    if (!card) return;
    const float = document.createElement('div');
    float.className = 'damage-float';
    float.textContent = `-${dmg}`;
    card.appendChild(float);
    float.addEventListener('animationend', () => float.remove());
  };

  const executeStep = (step: any, side: 'left' | 'right') => {
    const frame = document.getElementById(`fighter-${side}`);
    const card = document.querySelector(`.fighter-card.${side}`) as HTMLElement;
    if (step.type === 'attack') {
      if (card) card.style.zIndex = '20';
      frame?.classList.add('attacking');
      setTimeout(() => { frame?.classList.remove('attacking'); if (card) card.style.zIndex = ''; }, 600);
    } else if (step.type === 'dodge') {
      frame?.classList.add('dodging');
      setTimeout(() => frame?.classList.remove('dodging'), 500);
      showEffectText(side, 'УКЛОНЕНИЕ!', '#f1c40f');
    } else if (step.type === 'counter') {
      if (card) card.style.zIndex = '20';
      frame?.classList.add('attacking');
      setTimeout(() => { frame?.classList.remove('attacking'); if (card) card.style.zIndex = ''; }, 600);
      showEffectText(side, 'КОНТРАТАКА!', '#f1c40f');
    } else if (step.type === 'block') {
      frame?.classList.add('blocking');
      setTimeout(() => frame?.classList.remove('blocking'), 600);
      showEffectText(side, 'БЛОК!', '#3498db');
    } else if (step.type === 'fullBlock') {
      frame?.classList.add('blocking');
      setTimeout(() => frame?.classList.remove('blocking'), 600);
      showEffectText(side, 'ПОЛНЫЙ БЛОК!', '#9b59b6');
    } else if (step.type === 'crit') {
      frame?.classList.add('attacking');
      setTimeout(() => frame?.classList.remove('attacking'), 600);
      showEffectText(side, 'КРИТ!', '#e74c3c');
    } else if (step.type === 'stun') {
      frame?.classList.add('stunned');
      setTimeout(() => frame?.classList.remove('stunned'), 1000);
      showEffectText(side, 'ОГЛУШЁН', '#f1c40f');
    }
  };

  const scrollLog = useCallback(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, []);
  const stopAuto = useCallback(() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }, []);

  const nextStep = useCallback(async () => {
    if (stepLock.current) return;
    const steps = stepsRef.current;
    const next = currentStepRef.current + 1;
    if (next >= steps.length) { stopAuto(); return; }
    stepLock.current = true;
    const step = steps[next];
    currentStepRef.current = next;
    setCurrentStep(next);

    // Resolve which side acts: player when message starts with 'Вы' or step.actor is 'attacker'
    const playerActor = step.actor === 'attacker' || step.message?.startsWith('Вы');

    if (step.type === 'attack' || step.type === 'crit' || step.type === 'counter') {
      executeStep(step, playerActor ? 'left' : 'right');
    } else if (step.type === 'dodge') {
      executeStep(step, playerActor ? 'left' : 'right');
    } else if (step.type === 'block' || step.type === 'fullBlock') {
      // Block is on the defender side
      executeStep(step, playerActor ? 'right' : 'left');
    } else if (step.type === 'stun') {
      executeStep(step, playerActor ? 'right' : 'left');
    }

    // Apply damage
    if (step.type === 'damage' && step.damage) {
      if (step.target === 'player') {
        setPlayerHp(prev => Math.max(0, prev - step.damage));
        showDamageNumber('left', step.damage);
      } else {
        setMobHp(prev => Math.max(0, prev - step.damage));
        showDamageNumber('right', step.damage);
      }
    }

    scrollLog();
    const isDamage = step?.type === 'damage';
    await new Promise(r => setTimeout(r, (isDamage ? 1000 : 700) / speedRef.current));
    stepLock.current = false;
  }, [scrollLog, stopAuto]);

  const startAuto = useCallback(() => {
    stopAuto();
    if (stepsRef.current.length === 0) return;
    timerRef.current = window.setInterval(() => nextStep(), 1000 / speedRef.current);
  }, [nextStep, stopAuto]);

  useEffect(() => { if (battleSteps.length > 0 && currentStepRef.current === -1) startAuto(); return () => stopAuto(); }, [battleSteps, startAuto, stopAuto]);
  useEffect(() => { if (currentStep >= battleSteps.length - 1 && battleSteps.length > 0) stopAuto(); }, [currentStep, battleSteps.length, stopAuto]);
  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const selectFloor = async (floor: string) => {
    const fm = mobs.filter((m: any) => m.location === floor).sort((a: any, b: any) => a.level - b.level);
    const mob = fm[Math.floor(Math.random() * fm.length)];
    setSelectedFloor(floor);
    setSelectedMob(mob);
    setMobMaxHp(mob.hp);
    setMobHp(mob.hp);
    setError('');
    setBattleSteps([]);
    setBattleResult(null);
    setCurrentStep(-1);
    currentStepRef.current = -1;

    // Start battle immediately
    if (!character || cooldownRemaining > 0) return;
    setPhase('battle');
    const startHp = character.currentHp;
    const pStats = calculateStats(character, (character as any).drinkBonuses, (character as any).collectionCount || 0);
    initialHpRef.current = { player: startHp, mob: mob.hp };
    setPlayerMaxHp(pStats.hp);
    setPlayerHp(startHp);
    setLoading(true);
    try {
      const result = await attackMob(mob.id);
      setBattleSteps(result.steps || []);
      setBattleResult(result);
      // Дропы с задержкой
      const drops: any[] = [];
      if (result.materialDropped) drops.push(result.materialDropped);
      if (result.itemsDropped?.length) drops.push(...result.itemsDropped);
      // Камень улучшения мог выпасть вместе с материалом (тогда он только в steps)
      const hasStoneInSteps = result.steps?.some((s: any) => s.message?.includes('Камень улучшения'));
      const hasStoneInMaterial = result.materialDropped?.itemType === 'upgrade';
      if (hasStoneInSteps && !hasStoneInMaterial) {
        drops.push({ name: 'Камень улучшения (Хлам)', rarity_id: 0, rarity_display: 'Хлам', rarity_color: '#888888', count: 1, type: 'craft_item', itemType: 'upgrade' });
      }
      drops.forEach((d: any, i: number) => {
        setTimeout(() => showAcquire(d, 1, 'Добыто'), i * 400);
      });
      const fresh = await fetchCharacter();
      setCharacter(fresh);
      setCooldownRemaining((fresh as any)?.pveCooldownSec ?? getRemaining(((fresh as any)?.lastPveAttackTime || 0) + 300));
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = window.setInterval(() => {
        setCooldownRemaining(prev => {
          const next = Math.max(0, prev - 1);
          if (next <= 0 && cooldownTimerRef.current) { clearInterval(cooldownTimerRef.current!); cooldownTimerRef.current = null; }
          return next;
        });
      }, 1000);
    } catch (e: any) { setError(e.message); setPhase('floors'); }
    finally { setLoading(false); }
  };

  const handleSkip = () => {
    stopAuto();
    const steps = stepsRef.current;
    const last = steps.length - 1;
    currentStepRef.current = last;
    setCurrentStep(last);
    // Set final HP from battle result
    if (battleResult) {
      setPlayerHp(Math.max(0, battleResult.hpAfter ?? 0));
      setMobHp(Math.max(0, battleResult.hpDefenderAfter ?? 0));
    }
  };

  const toggleSpeed = () => {
    const ns = speed === 1 ? 2 : 1;
    setSpeed(ns);
    speedRef.current = ns;
    if (currentStepRef.current >= 0 && currentStepRef.current < stepsRef.current.length - 1) {
      stopAuto();
      timerRef.current = window.setInterval(() => nextStep(), 1000 / ns);
    }
  };

  const backToFloors = () => {
    stopAuto();
    setPhase('floors');
    setBattleSteps([]);
    setBattleResult(null);
    setCurrentStep(-1);
    currentStepRef.current = -1;
    setSelectedMob(null);
    updateCooldown();
  };

  const formatCooldown = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (!user || !character) return null;

  const battleActive = battleSteps.length > 0;
  const battleDone = battleActive && currentStep >= battleSteps.length - 1;
  // pStats used by CharacterCard via calculateStats called inline
  const visibleSteps = battleSteps.slice(Math.max(0, currentStep - 4), currentStep + 1);

  return (
    <div className="px-4 py-4 max-w-4xl mx-auto">

      {phase === 'floors' ? (
        <>
          <BackButton />
          <h1 className="text-xl font-bold mb-4 text-[var(--color-accent-danger)]">
            <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />ОХОТА
          </h1>
          {cooldownRemaining > 0 && (
            <div className="mb-4 text-sm text-[var(--color-accent-warning)] bg-[var(--color-bg-card)] border border-[var(--color-border-light)] rounded p-2 text-center">
              До следующей атаки: {formatCooldown(cooldownRemaining)}
            </div>
          )}
          {error && <p className="text-[var(--color-accent-danger)] mb-4">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {floors.map((floor) => {
              const info = getFloorInfo(floor);
              const disabled = cooldownRemaining > 0;
              const bg = floorBgMap.get(floor);
              return (
                <Card key={floor} className={`cursor-pointer hover:border-[var(--color-accent-info)] transition-colors relative overflow-hidden min-w-0 ${disabled ? 'opacity-50' : ''}`}
                  onClick={() => !disabled && selectFloor(floor)}
                  style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  <div className="relative z-10 bg-[var(--color-overlay-text)] rounded-lg p-2 -m-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="game-icons:castle-ruins" width="20" height="20" className="text-[var(--color-text-muted)]" />
                    <h3 className="font-bold text-sm">{floor}</h3>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                    <p>Уровни: {info.minLevel}–{info.maxLevel}</p>
                    <p className="font-bold text-[var(--color-text-secondary)]">Награда:</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="text-[var(--color-text-accent)]">◆ {info.goldMin}–{info.goldMax} серебра</span>
                      <span className="text-[var(--color-accent-success)]">◆ ~{info.avgXp} XP</span>
                    </div>
                    {info.lootImages.length > 0 && (
                      <div>
                        <span className="text-[var(--color-accent-purple)] text-[10px]">Лут:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {info.lootImages.map((l: any, idx: number) => {
                            const item = {
                              name: l.name,
                              rarity_id: Math.max(0, l.rarity),
                              image: l.image,
                              type: 'craft_item',
                              rarity_display: rarityNames[Math.max(0, l.rarity)] || l.name,
                              rarity_color: rarityColors[Math.max(0, l.rarity)] || '#888888',
                            };
                            return (
                              <div
                                key={l.name || idx}
                                className="relative w-7 h-7 flex items-center justify-center cursor-default"
                                onMouseEnter={(e) => setTooltipData({ item, x: e.clientX, y: e.clientY })}
                                onMouseMove={(e) => setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                                onMouseLeave={() => setTooltipData(null)}
                              >
                                <img src={l.image} alt={l.name} className="w-6 h-6 object-contain rounded" />
                                <span
                                  className="absolute bottom-0 right-0 text-[8px] text-white px-0.5 rounded-sm leading-none bg-black/65"
                                >
                                  {(l.chance * 100).toFixed(0)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {info.itemDropTable.length > 0 && (
                      <div>
                        <span className="text-[var(--color-accent-gold)] text-[10px]">🎲 Предметы:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {info.itemDropTable.map((it: any) => (
                            <div key={it.rarity} className="relative w-7 h-7 flex items-center justify-center cursor-default"
                              title={`${rarityNames[it.rarity]}: ${(it.chance * 100).toFixed(1)}%`}>
                              <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                                style={{ backgroundColor: rarityColors[it.rarity] || '#888', color: '#fff' }}>?</div>
                              <span className="absolute bottom-0 right-0 text-[7px] text-white px-0.5 rounded-sm leading-none bg-black/65">
                                {(it.chance * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {disabled && (
                    <div className="mt-2">
                      <Button variant="secondary" size="xs" fullWidth disabled>
                        <Icon icon="game-icons:hourglass" width="12" height="12" className="inline mr-1" />{formatCooldown(cooldownRemaining)}
                      </Button>
                    </div>
                  )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        /* Battle Phase — like Arena */
        <>
          <h1 className="text-center text-xl font-bold mb-4">
            <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />Охота: {selectedFloor}
          </h1>

          {/* Player + Mob cards side by side */}
          <div className="flex justify-center gap-4 sm:gap-8 mb-4">
            <CharacterCard
              char={{
                username: character.username,
                level: character.level,
                equipment: character.equipment,
                stats: calculateStats(character, (character as any).drinkBonuses, (character as any).collectionCount || 0),
                currentHp: playerHp,
                maxHp: playerMaxHp,
                gender: character.gender || 'male',
                guildName: (character as any).guildName,
                guildId: (character as any).guildId,
                avatar: (character as any).avatar || null,
              }}
              side="left"
              showHealth={battleActive}
              showExp={false}
              showRegenHint={false}
              readOnly
              compact={isVerySmall ? 'verySmall' : isMobile ? 'mobile' : true}
            />
            {selectedMob && (
              <CharacterCard
                char={{
                  username: selectedMob.name,
                  level: selectedMob.level,
                  equipment: {},
                  stats: { s: selectedMob.atk, a: selectedMob.agi, d: selectedMob.def, m: selectedMob.mst, hp: selectedMob.hp },
                  currentHp: mobHp,
                  maxHp: mobMaxHp,
                  gender: 'male',
                  avatar: selectedMob.background || null,
                }}
                side="right"
                showHealth={battleActive}
                showExp={false}
                showRegenHint={false}
                readOnly
                compact={isVerySmall ? 'verySmall' : isMobile ? 'mobile' : true}
                isMob
                hideNoGuild
              />
            )}
          </div>

          {/* Speed controls */}
          {battleActive && !battleDone && (
            <div className="flex justify-center gap-4 mb-4">
              <Button variant="primary" size="sm" onClick={toggleSpeed}>x{speed}</Button>
              <Button variant="secondary" size="sm" onClick={handleSkip}>Пропустить</Button>
            </div>
          )}

          {loading && <p className="text-center text-sm mb-4">Загрузка боя...</p>}

          {/* Battle log */}
          {battleActive && (
            <div ref={logRef} className="bg-[var(--color-bg-primary)]/90 rounded-lg p-3 min-h-[8em] max-h-[24em] overflow-y-auto font-mono text-xs leading-relaxed mb-4">
              {renderBattleLog(visibleSteps)}
            </div>
          )}

          {/* Result */}
          {battleDone && battleResult && (
            <Card className="text-center">
              <p className="font-bold text-lg mb-2">
                {battleResult.playerWon
                  ? <><Icon icon="game-icons:trophy" width="18" height="18" className="inline mr-1" />Победа!</>
                  : <><Icon icon="game-icons:death-skull" width="18" height="18" className="inline mr-1" />Поражение</>}
              </p>
              {battleResult.playerWon && (
                <div className="text-sm space-y-1 mb-3">
                  {battleResult.xpGained > 0 && <p>Опыт: +{battleResult.xpGained}</p>}
                  {battleResult.goldGained > 0 && <p>Награда: +{formatMoney(battleResult.goldGained)}{battleResult.premiumBonus > 0 ? <span className="text-[var(--color-text-accent)]"> (+{battleResult.premiumBonus} премиум)</span> : null}</p>}
                  {battleResult.levelsGained > 0 && <p className="text-[var(--color-accent-purple)]">Уровень +{battleResult.levelsGained}</p>}
                  {battleResult.materialDropped && (
                    <p className={rarityTextColors[battleResult.materialDropped.rarity_id] || 'text-[#aaa]'}>Добыто: {battleResult.materialDropped.name}</p>
                  )}
                </div>
              )}
              {!battleResult.playerWon && battleResult.goldLost > 0 && (
                <p className="text-[var(--color-accent-danger)] text-sm mb-3">Потеряно: {formatMoney(battleResult.goldLost)}</p>
              )}
              <div className="flex justify-center gap-3">
                <Button variant="danger" size="md" onClick={() => { stopAuto(); navigate('/'); }}>
                  На главную
                </Button>
              </div>
            </Card>
          )}

          {error && !battleDone && (
            <Card className="text-center">
              <p className="text-[var(--color-accent-danger)] mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={backToFloors}>Вернуться</Button>
            </Card>
          )}
        </>
      )}
      {tooltipData && <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />}
    </div>
  );
}
