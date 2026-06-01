import { useRef, useState, useCallback, useEffect } from 'react';
import { startBattle } from '../api';
import { calculateStats } from '../utils/stats';

function showEffectText(side: 'left' | 'right', text: string, color = '#f1c40f') {
    const overlay = document.getElementById(`effect-${side}`);
    if (!overlay) return;
    overlay.textContent = text;
    overlay.style.color = color;
    overlay.classList.add('show');
    overlay.addEventListener('animationend', () => overlay.classList.remove('show'), { once: true });
}

function showDamageNumber(side: 'left' | 'right', dmg: number) {
    const card = document.getElementById(`fighter-${side}`);
    if (!card) return;
    const float = document.createElement('div');
    float.className = 'damage-float';
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
    const [speed, setSpeed] = useState(1);
    const [autoPlaying, setAutoPlaying] = useState(false);

    const logContainerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number | null>(null);
    const stepLock = useRef(false);
    const currentStepRef = useRef(currentStep);
    const speedRef = useRef(speed);

    useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const loadOpponent = async (change = false) => {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Если смена, добавляем excludeId
            let url = `/api/arena/opponent?change=${change}`;
            if (change && opponent?.id) {
                url += `&excludeId=${opponent.id}`;
            }

            const res = await fetch(url, { headers });
            const data = await res.json();
            if (!res.ok) {
                setModalMessage(data.error || 'Ошибка загрузки соперника');
                return;
            }
            setOpponent(data);
            const pStats = calculateStats(character);
            setMaxHpLeft(pStats.hp);
            setHpLeft(character.currentHp);
            setMaxHpRight(data.stats.hp);
            setHpRight(data.stats.hp);
            speedRef.current = speed;
            if (change && data.playerMoney !== undefined) {
                setCharacter({ ...character, money: data.playerMoney });
            }
            setBattleSteps([]);
            setBattleResult(null);
            setCurrentStep(-1);
            setAutoPlaying(false);
        } catch (e) {
            setModalMessage('Ошибка сети');
        }
    };

    const handleStartBattle = async () => {
        if (!opponent) return;
        setLoading(true);
        try {
            const result = await startBattle(opponent.id);
            setHpLeft(character.currentHp);
            setHpRight(opponent.stats.hp);
            setBattleSteps(result.steps || result.log);
            setBattleResult(result);
            setCurrentStep(-1);
            if (result.moneyAfter !== undefined) {
                setCharacter({ ...character, money: result.moneyAfter });
            }
        } catch (e: any) {
            setModalMessage(e.message);
        } finally {
            setLoading(false);
        }
    };

    const executeStep = useCallback((step: any) => {
        // Рамки со слотами (для анимаций)
        const leftFrame = document.getElementById('fighter-left');
        const rightFrame = document.getElementById('fighter-right');
        // Карточки целиком (для z-index)
        const leftCard = document.querySelector('.fighter-card.left') as HTMLElement;
        const rightCard = document.querySelector('.fighter-card.right') as HTMLElement;

        if (step.type === 'damage' && step.damage) {
            if (step.target === 'attacker') {
                setHpLeft(prev => Math.max(0, prev - step.damage));
                showDamageNumber('left', step.damage);
            } else {
                setHpRight(prev => Math.max(0, prev - step.damage));
                showDamageNumber('right', step.damage);
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
            frame?.classList.add('dodging');
            setTimeout(() => frame?.classList.remove('dodging'), 500);
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
            frame?.classList.add('attacking');
            setTimeout(() => frame?.classList.remove('attacking'), 600);
            showEffectText(side, 'КРИТ!', '#e74c3c');
        } else if (step.type === 'stun') {
            const side = step.actor === 'attacker' ? 'left' : 'right';
            const frame = side === 'left' ? leftFrame : rightFrame;
            frame?.classList.add('stunned');
            setTimeout(() => frame?.classList.remove('stunned'), 1000);
            showEffectText(side, 'ОГЛУШЁН', '#f1c40f');
        }

        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, []);

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
        executeStep(battleSteps[next]);
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