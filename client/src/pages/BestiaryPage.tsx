import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { fetchMobs, attackMob } from '../api/mobs';
import { fetchCharacter } from '../api/character';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { renderBattleLog } from '../utils/battleLog';
import { formatMoney } from '../utils/money';
import { calculateStats } from '../utils/stats';
import CharacterCard from '../components/CharacterCard';

const rarityColors: Record<number, string> = {
  0: '#6b6b6b', 1: '#a0a0a0', 2: '#4a9b4a', 3: '#4a7ac0', 4: '#a040c0', 5: '#d4a020', 6: '#e03030',
};

const PVE_COOLDOWN_SEC = 300;

export default function BestiaryPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();

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
  useEffect(() => { loadMobs(); updateCooldown(); }, []);
  useEffect(() => {
    const handler = () => { setIsMobile(window.innerWidth < 600); setIsVerySmall(window.innerWidth < 420); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const updateCooldown = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const lastPve = (character as any)?.lastPveAttackTime || 0;
    const remaining = Math.max(0, PVE_COOLDOWN_SEC - (now - lastPve));
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
  }, [character]);

  useEffect(() => { return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); }; }, []);

  const loadMobs = async () => {
    try { setMobs(await fetchMobs()); } catch (e: any) { setError(e.message); }
  };

  // API returns mobs in level order — just deduplicate, no sort needed
  const floors: string[] = [];
  const seen = new Set<string>();
  for (const m of mobs) {
    if (!seen.has(m.location)) {
      seen.add(m.location);
      floors.push(m.location);
    }
  }

  const getFloorInfo = (floor: string) => {
    const fm = mobs.filter((m: any) => m.location === floor).sort((a: any, b: any) => a.level - b.level);
    return { count: fm.length, minLevel: fm[0]?.level || 0, maxLevel: fm[fm.length - 1]?.level || 0 };
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
      if (step.target === 'attacker') {
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
    const pStats = calculateStats(character);
    initialHpRef.current = { player: startHp, mob: mob.hp };
    setPlayerMaxHp(pStats.hp);
    setPlayerHp(startHp);
    setLoading(true);
    try {
      const result = await attackMob(mob.id);
      setBattleSteps(result.steps || []);
      setBattleResult(result);
      const fresh = await fetchCharacter();
      setCharacter(fresh);
      setCooldownRemaining(PVE_COOLDOWN_SEC);
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
      <BackButton to="/" />

      {phase === 'floors' ? (
        <>
          <h1 className="text-xl font-bold mb-4" style={{color:'red'}}>
            <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />ОХОТА v4
          </h1>
          {cooldownRemaining > 0 && (
            <div className="mb-4 text-sm text-[var(--color-accent-warning)] bg-[#2a2a2a] rounded p-2 text-center">
              До следующей атаки: {formatCooldown(cooldownRemaining)}
            </div>
          )}
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {floors.map((floor) => {
              const info = getFloorInfo(floor);
              const disabled = cooldownRemaining > 0;
              return (
                <Card key={floor} className={`cursor-pointer hover:border-[var(--color-accent-info)] transition-colors ${disabled ? 'opacity-50' : ''}`}
                  onClick={() => !disabled && selectFloor(floor)}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="game-icons:castle-ruins" width="20" height="20" className="text-[var(--color-text-muted)]" />
                    <h3 className="font-bold text-sm">{floor}</h3>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                    <p>Монстров: {info.count}</p>
                    <p>Уровни: {info.minLevel}–{info.maxLevel}</p>
                  </div>
                  {disabled && (
                    <div className="mt-2">
                      <Button variant="secondary" size="xs" fullWidth disabled>
                        <Icon icon="game-icons:hourglass" width="12" height="12" className="inline mr-1" />{formatCooldown(cooldownRemaining)}
                      </Button>
                    </div>
                  )}
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
                stats: calculateStats(character),
                currentHp: playerHp,
                maxHp: playerMaxHp,
                gender: character.gender || 'male',
              }}
              side="left"
              showHealth={battleActive}
              showExp={false}
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
                }}
                side="right"
                showHealth={battleActive}
                showExp={false}
                readOnly
                compact={isVerySmall ? 'verySmall' : isMobile ? 'mobile' : true}
                isMob
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
            <div ref={logRef} className="bg-black rounded-lg p-3 min-h-[8em] max-h-[24em] overflow-y-auto font-mono text-xs leading-relaxed mb-4">
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
                  {battleResult.goldGained > 0 && <p>Золото: +{formatMoney(battleResult.goldGained)}</p>}
                  {battleResult.levelsGained > 0 && <p className="text-[var(--color-accent-purple)]">Уровень +{battleResult.levelsGained}</p>}
                  {battleResult.materialDropped && (
                    <p style={{ color: rarityColors[battleResult.materialDropped.rarity_id] || '#aaa' }}>Добыто: {battleResult.materialDropped.name}</p>
                  )}
                </div>
              )}
              {!battleResult.playerWon && battleResult.goldLost > 0 && (
                <p className="text-red-500 text-sm mb-3">Потеряно: {formatMoney(battleResult.goldLost)}</p>
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
              <p className="text-red-500 mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={backToFloors}>Вернуться</Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
