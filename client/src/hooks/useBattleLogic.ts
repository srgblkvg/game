import { useRef, useState, useCallback, useEffect } from 'react';
import { startBattle } from '../api';

function showEffectText(side: 'left' | 'right', text: string, color = '#f1c40f') {
    const overlay = document.getElementById(`effect-${side}`);
    if (!overlay) return;
    overlay.textContent = text;
    overlay.style.color = color;
    overlay.classList.add('show');
    overlay.addEventListener('animationend', () => overlay.classList.remove('show'), { once: true });
}

function showDamageNumber(side: 'left' | 'right', dmg: number, isCrit = false) {
    const card = document.getElementById(`fighter-${side}`);
    if (!card) return;
    const float = document.createElement('div');
    float.className = `damage-float${isCrit ? ' crit-damage' : ''}`;
    float.textContent = `-${dmg}`;
    card.appendChild(float);
    float.addEventListener('animationend', () => float.remove());
}

export function useBattleLogic(userId: number, character: any, setCharacter: (c: any) => void) {
    const [opponent, setOpponent] = useState<any>(null);
    const [battleSteps, setBattleSteps] = useState<any[]>([]);
    const [currentStep, setCurrentStep] = useState(-1);
    const [battleResult, setBattleResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hpLeft, setHpLeft] = useState(0);
    const [maxHpLeft, setMaxHpLeft] = useState(0);
    const [hpRight, setHpRight] = useState(0);
    const [maxHpRight, setMaxHpRight] = useState(0);
    const [modalMessage, setModalMessage] = useState<string | null>(null);
    const [speed, setSpeed] = useState(2);
    const [autoPlaying, setAutoPlaying] = useState(false);

    const logContainerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number | null>(null);
    const stepLock = useRef(false);
    const currentStepRef = useRef(currentStep);
    const speedRef = useRef(speed);

    useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const loadOpponent = async (change = false, difficulty: string = 'equal') => {
        setLoading(true);
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            let url = `/api/arena/opponent?change=${change}&difficulty=${difficulty}`;
            if (change && opponent?.id) {
                url += `&excludeId=${opponent.id}`;
            }

            const res = await fetch(url, { headers });
            const data = await res.json();
            if (!res.ok) {
                setModalMessage(data.error || 'Ошибка загрузки соперника');
                setOpponent(null); // сбрасываем, чтобы избежать показа невалидного соперника
                return;
            }
            // Защита от неполных данных
            if (!data || !data.id || !data.stats) {
                setModalMessage('Некорректный ответ сервера');
                setOpponent(null);
                return;
            }
            setOpponent(data);
            const pStats = character.stats;
            if (pStats) {
              setMaxHpLeft(pStats.hp);
            }
            setHpLeft(character.currentHp);
            setMaxHpRight(data.stats.hp);
            setHpRight(data.stats.hp);
            speedRef.current = speed;
            if (change && data.playerMoney !== undefined) {
                setCharacter({ ...character, money: data.playerMoney });
            }
            // also update money on non-change (difficulty switch charges on server)
            if (!change && data.playerMoney !== undefined && data.playerMoney !== character.money) {
                setCharacter({ ...character, money: data.playerMoney });
            }
            setBattleSteps([]);
            setBattleResult(null);
            setCurrentStep(-1);
            setAutoPlaying(false);
        } catch (e) {
            setModalMessage('Ошибка сети');
            setOpponent(null);
        } finally {
            setLoading(false);
        }
    };

    const handleStartBattle = async () => {
        if (!opponent) return;
        setLoading(true);
        (window as any).__battling = true; // блокируем WS balance
        try {
            const result = await startBattle(opponent.id);
            setHpLeft(character.currentHp);
            setHpRight(opponent.stats.hp);
            setBattleSteps(result.steps || result.log);
            setBattleResult(result);
            setCurrentStep(-1);
            // Деньги/опыт обновятся в finishBattle после анимации
        } catch (e: any) {
            setModalMessage(e.message);
        } finally {
            setLoading(false);
        }
    };

    const executeStep = useCallback((step: any, stepIndex: number) => {
        // Рамки со слотами (для анимаций)
        const leftFrame = document.getElementById('fighter-left');
        const rightFrame = document.getElementById('fighter-right');
        // Карточки целиком (для z-index)
        const leftCard = document.querySelector('.fighter-card.left') as HTMLElement;
        const rightCard = document.querySelector('.fighter-card.right') as HTMLElement;

        // Проверяем: был ли крит перед этим damage-шагом
        const isCritDamage = step.type === 'damage' && battleSteps[stepIndex - 1]?.type === 'crit';

        if (step.type === 'damage' && step.damage) {
            if (step.target === 'attacker') {
                setHpLeft(prev => Math.max(0, prev - step.damage));
                showDamageNumber('left', step.damage, isCritDamage);
            } else {
                setHpRight(prev => Math.max(0, prev - step.damage));
                showDamageNumber('right', step.damage, isCritDamage);
            }
            // Screen shake при крит-уроне
            if (isCritDamage) {
                const arena = document.querySelector('[data-battle-arena]');
                if (arena) {
                    (arena as HTMLElement).style.animation = 'screen-shake 0.5s ease-out';
                    setTimeout(() => (arena as HTMLElement).style.animation = '', 500);
                }
            }
        }

        if (step.type === 'attack') {
            if (step.actor === 'attacker') {
                if (leftCard) leftCard.style.zIndex = '20';
                leftFrame?.classList.add('attacking');
                setTimeout(() => {
                    leftFrame?.classList.remove('attacking');
                    if (leftCard) leftCard.style.zIndex = '';
                }, 600);
            } else {
                if (rightCard) rightCard.style.zIndex = '20';
                rightFrame?.classList.add('attacking');
                setTimeout(() => {
                    rightFrame?.classList.remove('attacking');
                    if (rightCard) rightCard.style.zIndex = '';
                }, 600);
            }
        } else if (step.type === 'dodge') {
            const side = step.actor === 'attacker' ? 'left' : 'right';
            const frame = side === 'left' ? leftFrame : rightFrame;
            const card = side === 'left' ? leftCard : rightCard;
            if (card) card.style.zIndex = '20';
            if (frame) frame.style.filter = ''; // сброс blur перед dodging
            frame?.classList.add('dodging');
            setTimeout(() => {
                frame?.classList.remove('dodging');
                frame!.style.filter = '';
                if (card) card.style.zIndex = '';
            }, 550);
            showEffectText(side, 'УКЛОНЕНИЕ!', '#f1c40f');
        } else if (step.type === 'counter') {
            const side = step.actor === 'attacker' ? 'left' : 'right';
            const frame = side === 'left' ? leftFrame : rightFrame;
            const card = side === 'left' ? leftCard : rightCard;
            if (card) card.style.zIndex = '20';
            frame?.classList.add('attacking');
            setTimeout(() => {
                frame?.classList.remove('attacking');
                if (card) card.style.zIndex = '';
            }, 600);
            showEffectText(side, 'КОНТРАТАКА!', '#f1c40f');
        } else if (step.type === 'block') {
            const side = step.actor === 'defender' ? 'right' : 'left';
            const frame = side === 'left' ? leftFrame : rightFrame;
            frame?.classList.add('blocking');
            setTimeout(() => frame?.classList.remove('blocking'), 600);
            showEffectText(side, 'БЛОК!', '#3498db');
        } else if (step.type === 'fullBlock') {
            const side = step.actor === 'defender' ? 'right' : 'left';
            const frame = side === 'left' ? leftFrame : rightFrame;
            frame?.classList.add('blocking');
            setTimeout(() => frame?.classList.remove('blocking'), 600);
            showEffectText(side, 'ПОЛНЫЙ БЛОК!', '#9b59b6');
        } else if (step.type === 'crit') {
            const side = step.actor === 'attacker' ? 'left' : 'right';
            const frame = side === 'left' ? leftFrame : rightFrame;
            const card = side === 'left' ? leftCard : rightCard;
            if (card) card.style.zIndex = '30';
            // Снимаем attacking чтобы не конфликтовало с critting
            frame?.classList.remove('attacking');
            frame?.classList.add('critting');
            setTimeout(() => {
                frame?.classList.remove('critting');
                frame!.style.filter = '';
                frame!.style.outline = '';
                if (card) card.style.zIndex = '';
            }, 800);
            showEffectText(side, 'КРИТ!', '#e74c3c');
        } else if (step.type === 'stun') {
            const side = step.actor === 'attacker' ? 'left' : 'right';
            const frame = side === 'left' ? leftFrame : rightFrame;
            frame?.classList.add('stunned');
            setTimeout(() => frame?.classList.remove('stunned'), 800);
            showEffectText(side, 'ОГЛУШЁН!', '#f1c40f');
        }

        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [battleSteps]);

    const nextStep = useCallback(async () => {
        if (stepLock.current) return;
        const cur = currentStepRef.current;
        const next = cur + 1;
        if (next >= battleSteps.length) {
            stopAuto();
            return;
        }
        stepLock.current = true;
        setCurrentStep(next);
        executeStep(battleSteps[next], next);
        // extra pause after damage so HP bar animates before next step
        const isDamage = battleSteps[next]?.type === 'damage';
        await new Promise(r => setTimeout(r, (isDamage ? 1000 : 700) / speedRef.current));
        stepLock.current = false;
    }, [battleSteps, executeStep]);

    const stopAuto = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setAutoPlaying(false);
    }, []);

    const startAuto = useCallback(() => {
        stopAuto();
        if (battleSteps.length === 0) return;
        setAutoPlaying(true);
        timerRef.current = window.setInterval(() => nextStep(), 1000 / speedRef.current);
    }, [battleSteps, nextStep, stopAuto]);

    useEffect(() => {
        if (battleSteps.length > 0 && currentStepRef.current === -1 && !autoPlaying) {
            startAuto();
        }
    }, [battleSteps, autoPlaying, startAuto]);

    useEffect(() => {
        if (currentStep >= battleSteps.length - 1 && battleSteps.length > 0 && autoPlaying) {
            stopAuto();
        }
    }, [currentStep, battleSteps.length, autoPlaying, stopAuto]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleSkip = () => {
        stopAuto();
        const last = battleSteps.length - 1;
        setCurrentStep(last);
        currentStepRef.current = last;
        if (battleResult) {
            setHpLeft(Math.max(0, battleResult.hpAfter ?? 0));
            setHpRight(Math.max(0, battleResult.hpDefenderAfter ?? 0));
        }
        window.dispatchEvent(new CustomEvent('battleEnd'));
        (window as any).__battling = false;
    };

    const toggleSpeed = () => {
        const newSpeed = speed === 1 ? 2 : 1;
        setSpeed(newSpeed);
        speedRef.current = newSpeed;
        if (autoPlaying) startAuto();
    };

    const finishBattle = () => {
        if (!battleResult) return;
        const statsGained = (battleResult.levelsGained || 0) * 5;
        setCharacter({
            ...character,
            currentHp: Math.max(0, battleResult.hpAfter),
            level: battleResult.newLevel,
            exp: battleResult.newExp,
            statPoints: (character.statPoints || 0) + statsGained,
            money: battleResult.moneyAfter ?? character.money,
            totalBattles: character.totalBattles + 1,
            wins: battleResult.winnerId === userId ? character.wins + 1 : character.wins,
        });
        // Полное обновление с сервера (ELO, рейтинги, etc.)
        import('../api/character').then(m => m.fetchCharacter().then(setCharacter).catch(() => {}));
        window.dispatchEvent(new CustomEvent('battleEnd'));
        (window as any).__battling = false;
    };

    return {
        opponent,
        battleSteps,
        currentStep,
        battleResult,
        loading,
        hpLeft,
        maxHpLeft,
        hpRight,
        maxHpRight,
        modalMessage,
        speed,
        autoPlaying,
        logContainerRef,
        loadOpponent,
        handleStartBattle,
        handleSkip,
        toggleSpeed,
        setModalMessage,
        finishBattle,
    };
}