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

type Phase = 'floors' | 'battle';

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

  // Refs to avoid stale closure in timer callbacks
  const timerRef = useRef<number | null>(null);
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

  const loadMobs = async () => {
    try {
      setMobs(await fetchMobs());
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Group mobs by location, sorted alphabetically
  const floors = [...new Set(mobs.map((m: any) => m.location))].sort();

  const getFloorInfo = (floor: string) => {
    const fm = mobs.filter((m: any) => m.location === floor);
    const minLevel = Math.min(...fm.map((m: any) => m.level));
    const maxLevel = Math.max(...fm.map((m: any) => m.level));
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
        // "Вы атакуете!" → player; anything else → mob
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

  const selectFloor = async (floor: string) => {
    setSelectedFloor(floor);
    const fm = mobs.filter((m: any) => m.location === floor);
    const mob = fm[Math.floor(Math.random() * fm.length)];
    setSelectedMob(mob);
    setMobMaxHp(mob.hp);
    setMobHp(mob.hp);
    setPhase('battle');
    setBattleSteps([]);
    setBattleResult(null);
    setCurrentStep(-1);
    currentStepRef.current = -1;
    setError('');

    if (!character) return;

    // Capture initial HPs before battle
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

      // Fetch fresh character after battle
      const fresh = await fetchCharacter();
      setCharacter(fresh);
    } catch (e: any) {
      setError(e.message);
      setPhase('floors');
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
        /* ── Floor Selection ── */
        <>
          <h1 className="text-xl font-bold mb-4">
            <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />
            Охота
          </h1>
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
      ) : (
        /* ── Battle Phase ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">
              <Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />
              Охота: {selectedFloor}
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
              <Button variant="danger" size="md" onClick={backToFloors}>
                <Icon icon="game-icons:castle-ruins" width="16" height="16" className="inline mr-1" />
                Вернуться к выбору этажа
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
