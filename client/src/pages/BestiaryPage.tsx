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

const rarityColors: Record<number, string> = {
  0: '#6b6b6b', 1: '#a0a0a0', 2: '#4a9b4a', 3: '#4a7ac0', 4: '#a040c0', 5: '#d4a020', 6: '#e03030',
};

const PVE_COOLDOWN_SEC = 300; // 5 minutes

type Phase = 'floors' | 'mob_card' | 'battle';

const STAT_LABELS: Record<string, { label: string; icon: string }> = {
  atk: { label: 'АТК', icon: 'game-icons:biceps' },
  agi: { label: 'ЛВК', icon: 'game-icons:sprint' },
  def: { label: 'ЗЩТ', icon: 'game-icons:shield' },
  mst: { label: 'МСТ', icon: 'game-icons:crossed-swords' },
};

export default function BestiaryPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('floors');
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

  // Refs to avoid stale closure in timer callbacks
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
  useEffect(() => { loadMobs(); }, []);

  // Compute cooldown from character data
  useEffect(() => {
    if (!character) return;
    updateCooldown();
  }, [character]);

  const updateCooldown = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const lastPve = (character as any)?.lastPveAttackTime || 0;
    const elapsed = now - lastPve;
    const remaining = Math.max(0, PVE_COOLDOWN_SEC - elapsed);
    setCooldownRemaining(remaining);

    // Start countdown timer
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (remaining > 0) {
      cooldownTimerRef.current = window.setInterval(() => {
        setCooldownRemaining((prev) => {
          const next = Math.max(0, prev - 1);
          if (next <= 0 && cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return next;
        });
      }, 1000);
    }
    return remaining;
  }, [character]);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const loadMobs = async () => {
    try {
      setMobs(await fetchMobs());
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Group mobs by location, sorted alphabetically; mobs within each floor sorted by level
  const floors = [...new Set(mobs.map((m: any) => m.location))].sort();

  const getFloorMobs = (floor: string) => {
    return mobs
      .filter((m: any) => m.location === floor)
      .sort((a: any, b: any) => a.level - b.level);
  };

  const getFloorInfo = (floor: string) => {
    const fm = getFloorMobs(floor);
    const minLevel = fm.length > 0 ? fm[0].level : 0;
    const maxLevel = fm.length > 0 ? fm[fm.length - 1].level : 0;
    return { count: fm.length, minLevel, maxLevel };
  };

  // Compute HP at a given step index by parsing attacker from messages
  const computeHp = useCallback((stepIndex: number) => {
    const steps = stepsRef.current;
    const { player: startPlayerHp, mob: startMobHp } = initialHpRef.current;
    let pHp = startPlayerHp;
    let mHp = startMobHp;
    let currentAttacker: 'player' | 'mob' | null = null;

    for (let i = 0; i <= stepIndex && i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      if (step.type === 'attack') {
        currentAttacker = step.message.startsWith('Вы') ? 'player' : 'mob';
      } else if (step.type === 'damage' && step.damage) {
        if (currentAttacker === 'player') {
          mHp = Math.max(0, mHp - step.damage);
        } else if (currentAttacker === 'mob') {
          pHp = Math.max(0, pHp - step.damage);
        }
      }
    }
    return { playerHp: pHp, mobHp: mHp };
  }, []);

  const scrollLog = useCallback(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, []);

  const stopAuto = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const nextStep = useCallback(() => {
    if (stepLock.current) return;
    const steps = stepsRef.current;
    const cur = currentStepRef.current;
    const next = cur + 1;
    if (next >= steps.length) {
      stopAuto();
      return;
    }
    stepLock.current = true;
    currentStepRef.current = next;
    setCurrentStep(next);

    const hp = computeHp(next);
    setPlayerHp(hp.playerHp);
    setMobHp(hp.mobHp);
    scrollLog();

    const isDamage = steps[next]?.type === 'damage';
    setTimeout(() => {
      stepLock.current = false;
    }, (isDamage ? 1000 : 700) / speedRef.current);
  }, [computeHp, scrollLog, stopAuto]);

  const startAuto = useCallback(() => {
    stopAuto();
    if (stepsRef.current.length === 0) return;
    timerRef.current = window.setInterval(
      () => nextStep(),
      1000 / speedRef.current,
    );
  }, [nextStep, stopAuto]);

  // Auto-start animation when battle steps load
  useEffect(() => {
    if (battleSteps.length > 0 && currentStepRef.current === -1) {
      startAuto();
    }
    return () => stopAuto();
  }, [battleSteps, startAuto, stopAuto]);

  // Stop animation when all steps are shown
  useEffect(() => {
    if (currentStep >= battleSteps.length - 1 && battleSteps.length > 0) {
      stopAuto();
    }
  }, [currentStep, battleSteps.length, stopAuto]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Step 1: Select a floor → show random mob card with stats and attack button
  const selectFloor = (floor: string) => {
    setSelectedFloor(floor);
    const fm = getFloorMobs(floor);
    const mob = fm[Math.floor(Math.random() * fm.length)];
    setSelectedMob(mob);
    setMobMaxHp(mob.hp);
    setMobHp(mob.hp);
    setPhase('mob_card');
    setError('');
    setBattleSteps([]);
    setBattleResult(null);
    setCurrentStep(-1);
    currentStepRef.current = -1;
  };

  // Step 2: Attack the selected mob
  const handleAttack = async () => {
    if (!character || !selectedMob || cooldownRemaining > 0) return;

    setPhase('battle');

    const startHp = character.currentHp;
    const pStats = calculateStats(character);
    initialHpRef.current = { player: startHp, mob: selectedMob.hp };
    setPlayerMaxHp(pStats.hp);
    setPlayerHp(startHp);

    setLoading(true);
    try {
      const result = await attackMob(selectedMob.id);
      setBattleSteps(result.steps || []);
      setBattleResult(result);

      // Fetch fresh character after battle
      const fresh = await fetchCharacter();
      setCharacter(fresh);
      // Update cooldown after attack
      const now = Math.floor(Date.now() / 1000);
      setCooldownRemaining(PVE_COOLDOWN_SEC);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = window.setInterval(() => {
        setCooldownRemaining((prev) => {
          const next = Math.max(0, prev - 1);
          if (next <= 0 && cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      setError(e.message);
      setPhase('mob_card');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    stopAuto();
    const steps = stepsRef.current;
    const last = steps.length - 1;
    currentStepRef.current = last;
    setCurrentStep(last);
    const hp = computeHp(last);
    setPlayerHp(hp.playerHp);
    setMobHp(hp.mobHp);
  };

  const toggleSpeed = () => {
    const ns = speed === 1 ? 2 : 1;
    setSpeed(ns);
    speedRef.current = ns;
    const steps = stepsRef.current;
    const cur = currentStepRef.current;
    if (cur >= 0 && cur < steps.length - 1) {
      stopAuto();
      timerRef.current = window.setInterval(
        () => nextStep(),
        1000 / ns,
      );
    }
  };

  const backToFloors = () => {
    stopAuto();
    setPhase('floors');
    setBattleSteps([]);
    setBattleResult(null);
    setCurrentStep(-1);
    currentStepRef.current = -1;
    // Refresh cooldown from character
    updateCooldown();
  };

  const backToMobCard = () => {
    stopAuto();
    setPhase('mob_card');
    setBattleSteps([]);
    setBattleResult(null);
    setCurrentStep(-1);
    currentStepRef.current = -1;
  };

  const formatCooldown = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (!user || !character) return null;

  const battleActive = battleSteps.length > 0;
  const battleDone = battleActive && currentStep >= battleSteps.length - 1;

  const visibleSteps = battleSteps.slice(
    Math.max(0, currentStep - 4),
    currentStep + 1,
  );

  return (
    <div className="px-4 py-4 max-w-4xl mx-auto">
      <BackButton to="/" />

      {phase === 'floors' ? (
        /* ―― Floor Selection ―― */
        <>
          <h1 className="text-xl font-bold mb-4">
            <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />
            Охота
          </h1>
          {cooldownRemaining > 0 && (
            <div className="mb-4 text-sm text-[var(--color-accent-warning)] bg-[#2a2a2a] rounded p-2 text-center">
              <Icon icon="game-icons:duration" width="16" height="16" className="inline mr-1" />
              До следующей атаки: {formatCooldown(cooldownRemaining)}
            </div>
          )}
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {floors.map((floor) => {
              const info = getFloorInfo(floor);
              return (
                <Card
                  key={floor}
                  className="cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                  onClick={() => selectFloor(floor)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="game-icons:castle-ruins" width="20" height="20" className="text-[var(--color-text-muted)]" />
                    <h3 className="font-bold text-sm">{floor}</h3>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                    <p>
                      <Icon icon="game-icons:death-skull" width="12" height="12" className="inline mr-1" />
                      Монстров: {info.count}
                    </p>
                    <p>
                      <Icon icon="game-icons:level-end-flag" width="12" height="12" className="inline mr-1" />
                      Уровни: {info.minLevel}–{info.maxLevel}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : phase === 'mob_card' ? (
        /* ―― Mob Card with Stats and Attack Button ―― */
        <>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">
              <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />
              {selectedFloor}
            </h1>
            <Button variant="ghost" size="xs" onClick={backToFloors}>
              <Icon icon="game-icons:castle-ruins" width="14" height="14" className="inline mr-1" />
              Этажи
            </Button>
          </div>

          {error && (
            <Card className="mb-4 text-center">
              <p className="text-red-500 mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={backToFloors}>
                Вернуться к выбору этажа
              </Button>
            </Card>
          )}

          {selectedMob && (
            <>
              {/* Mob Stats Card — character-card style, no equipment slots */}
              <div className="flex justify-center mb-6">
                <div
                  style={{
                    background: '#2a2a3e',
                    border: '2px solid #555',
                    borderRadius: '12px',
                    padding: '1.2rem',
                    width: '220px',
                    textAlign: 'center',
                    color: '#eee',
                  }}
                >
                  {/* Mob name + level */}
                  <h2 className="text-lg font-bold mb-1">{selectedMob.name}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">Ур. {selectedMob.level}</p>

                  {/* HP bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span>HP</span>
                      <span>{selectedMob.hp}</span>
                    </div>
                    <div className="w-full bg-[#333] rounded h-3 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--color-accent-danger)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats table: ATK, AGI, DEF, MST */}
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      {(['atk', 'agi', 'def', 'mst'] as const).map((key) => (
                        <tr key={key} className="border-b border-[#444]">
                          <td className="text-left py-1.5 px-2">
                            <Icon
                              icon={STAT_LABELS[key].icon}
                              width="16"
                              height="16"
                              className="inline mr-2"
                            />
                            {STAT_LABELS[key].label}
                          </td>
                          <td className="text-right py-1.5 px-2 font-mono tabular-nums">
                            {selectedMob[key]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Attack button with cooldown */}
                  <div className="mt-5">
                    {cooldownRemaining > 0 ? (
                      <Button variant="secondary" size="md" disabled className="w-full">
                        <Icon icon="game-icons:duration" width="16" height="16" className="inline mr-1" />
                        {formatCooldown(cooldownRemaining)}
                      </Button>
                    ) : (
                      <Button variant="danger" size="md" onClick={handleAttack} className="w-full">
                        <Icon icon="game-icons:crossed-swords" width="18" height="18" className="inline mr-1" />
                        Атаковать
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        /* ―― Battle Phase ―― */
        <>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">
              <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />
              Охота: {selectedFloor}
            </h1>
            <Button variant="ghost" size="xs" onClick={backToMobCard}>
              <Icon icon="game-icons:castle-ruins" width="14" height="14" className="inline mr-1" />
              Назад
            </Button>
          </div>

          {error && (
            <Card className="mb-4 text-center">
              <p className="text-red-500 mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={backToMobCard}>
                Вернуться
              </Button>
            </Card>
          )}

          {/* HP Bars */}
          {battleActive && (
            <div className="mb-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{character.username} (ур. {character.level})</span>
                  <span className="tabular-nums">{playerHp}/{playerMaxHp}</span>
                </div>
                <div className="w-full bg-[#333] rounded h-3 overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${playerMaxHp > 0 ? Math.max(0, (playerHp / playerMaxHp) * 100) : 0}%`,
                      backgroundColor: 'var(--color-accent-info)',
                    }}
                  />
                </div>
              </div>
              {selectedMob && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{selectedMob.name} (ур. {selectedMob.level})</span>
                    <span className="tabular-nums">{mobHp}/{mobMaxHp}</span>
                  </div>
                  <div className="w-full bg-[#333] rounded h-3 overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{
                        width: `${mobMaxHp > 0 ? Math.max(0, (mobHp / mobMaxHp) * 100) : 0}%`,
                        backgroundColor: 'var(--color-accent-danger)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-8">
              <Icon icon="game-icons:crossed-swords" width="40" height="40" className="inline-block mb-3 animate-pulse text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-muted)]">Бой идёт...</p>
            </div>
          )}

          {/* Speed controls */}
          {battleActive && !battleDone && !loading && (
            <div className="flex justify-center gap-4 mb-4">
              <Button variant="primary" size="sm" onClick={toggleSpeed}>
                <Icon icon="game-icons:duration" width="14" height="14" className="inline mr-1" />
                x{speed === 2 ? '1' : '2'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleSkip}>
                <Icon icon="game-icons:fast-forward-button" width="14" height="14" className="inline mr-1" />
                Пропустить
              </Button>
            </div>
          )}

          {/* Battle Log */}
          {battleActive && !loading && (
            <div
              ref={logRef}
              className="bg-black rounded-lg p-3 min-h-[8em] max-h-[24em] overflow-y-auto font-mono text-xs leading-relaxed mb-4"
            >
              {renderBattleLog(visibleSteps)}
            </div>
          )}

          {/* Result */}
          {battleDone && battleResult && (
            <Card className="text-center">
              <p className="font-bold text-lg mb-3">
                {battleResult.playerWon ? (
                  <span className="text-[var(--color-accent-success)]">
                    <Icon icon="game-icons:trophy" width="20" height="20" className="inline mr-1" />
                    Победа!
                  </span>
                ) : (
                  <span className="text-[var(--color-accent-danger)]">
                    <Icon icon="game-icons:death-skull" width="20" height="20" className="inline mr-1" />
                    Поражение
                  </span>
                )}
              </p>
              <div className="text-sm space-y-1.5 mb-4">
                <p>
                  <Icon icon="game-icons:star-swirl" width="14" height="14" className="inline mr-1 text-[var(--color-accent-purple)]" />
                  Опыт: +{battleResult.xpGained}
                </p>
                {battleResult.playerWon && battleResult.goldGained > 0 && (
                  <p>
                    <Icon icon="game-icons:coins" width="14" height="14" className="inline mr-1" />
                    Серебро: +{formatMoney(battleResult.goldGained)}
                  </p>
                )}
                {!battleResult.playerWon && battleResult.goldLost > 0 && (
                  <p className="text-red-500">
                    <Icon icon="game-icons:cash" width="14" height="14" className="inline mr-1" />
                    Потеряно: {formatMoney(battleResult.goldLost)}
                  </p>
                )}
                {battleResult.levelsGained > 0 && (
                  <p className="text-[var(--color-accent-purple)]">
                    <Icon icon="game-icons:level-end-flag" width="14" height="14" className="inline mr-1" />
                    Уровень +{battleResult.levelsGained} (+{battleResult.levelsGained * 5} очк.)
                  </p>
                )}
                {battleResult.materialDropped && (
                  <p style={{ color: rarityColors[battleResult.materialDropped.rarity_id] || '#aaa' }}>
                    <Icon icon="game-icons:minerals" width="14" height="14" className="inline mr-1" />
                    Добыто: {battleResult.materialDropped.name}
                  </p>
                )}
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="danger" size="md" onClick={() => navigate('/')}>
                  <Icon icon="game-icons:castle" width="16" height="16" className="inline mr-1" />
                  На главную
                </Button>
                <Button variant="secondary" size="md" onClick={backToFloors}>
                  <Icon icon="game-icons:castle-ruins" width="16" height="16" className="inline mr-1" />
                  К этажам
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
