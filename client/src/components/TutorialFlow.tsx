import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { getHeaders } from '../api/helpers';
import Button from './ui/Button';

interface TutorialFlowProps {
    onComplete: () => void;
}

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

// Steps definition
interface FlowStep {
    targetSelector: string; // CSS selector to highlight
    title: string;
    description: string;
    buttonText: string; // button text in tooltip
    action: 'pve' | 'equip' | 'navigate-craft' | 'craft' | 'equip-shield' | 'arena' | 'complete';
    navigateTo?: string; // if set, navigate here when step starts
}

const FLOW_STEPS: FlowStep[] = [
    {
        targetSelector: '#site-header',
        title: 'Первая атака',
        description: 'Нажми кнопку чтобы атаковать монстра в Склепе. Победа гарантирована!',
        buttonText: '⚔ Атаковать',
        action: 'pve',
    },
    {
        targetSelector: '[data-tutorial="inventory"]',
        title: 'Добыча!',
        description: 'Ты получил Меч «Стон могильщика» и Пыль забвения. Нажми на меч в инвентаре (слева), затем нажми на слот Оружие в карточке персонажа.',
        buttonText: '✓ Надел — готово',
        action: 'equip',
    },
    {
        targetSelector: '#action-card-Ремесло',
        title: 'Ремесло',
        description: 'Нажми на карточку «Ремесло» в центре экрана чтобы перейти к созданию щита.',
        buttonText: '🔨 Открыть Ремесло',
        action: 'navigate-craft',
        navigateTo: '/craft',
    },
    {
        targetSelector: '#action-card-Ремесло',
        title: 'Создаём щит',
        description: 'Из Пыли забвения создадим щит «Гробовая преграда». 100% успех.',
        buttonText: '🔨 Создать щит',
        action: 'craft',
    },
    {
        targetSelector: '[data-tutorial="inventory"]',
        title: 'Щит готов!',
        description: 'Щит «Гробовая преграда» в инвентаре. Нажми на него, затем на слот Щит в карточке персонажа.',
        buttonText: '✓ Надел — готово',
        action: 'equip-shield',
    },
    {
        targetSelector: '#action-card-Арена',
        title: 'Арена!',
        description: 'Нажми на карточку «Арена» — сразись с тренировочным големом.',
        buttonText: '⚔ На арену!',
        action: 'arena',
    },
    {
        targetSelector: '#site-header',
        title: 'Обучение пройдено!',
        description: 'Ты освоил основы: бой, экипировку, крафт и PvP. Пока кулдауны — исследуй мир. Награда: 1000 серебра.',
        buttonText: '🎯 Завершить',
        action: 'complete',
    },
];

export default function TutorialFlow({ onComplete }: TutorialFlowProps) {
    const { character, setCharacter } = useGame();
    const { showToast } = useToast();
    const [stepIdx, setStepIdx] = useState(character?.tutorialStep || 0);
    const [loading, setLoading] = useState(false);
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const pollRef = useRef<number>(0);
    const navigatedRef = useRef(false);

    const currentStep = FLOW_STEPS[Math.min(stepIdx, FLOW_STEPS.length - 1)];

    // Find and measure target element
    useEffect(() => {
        const el = document.querySelector(currentStep.targetSelector);
        if (el) {
            const r = el.getBoundingClientRect();
            setTargetRect({
                top: r.top + window.scrollY,
                left: r.left + window.scrollX,
                width: r.width,
                height: r.height,
            });
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [stepIdx, currentStep.targetSelector]);

    // Auto-navigate for craft step
    useEffect(() => {
        const step = FLOW_STEPS[stepIdx];
        if (step?.navigateTo && !navigatedRef.current) {
            navigatedRef.current = true;
            // Use history pushState to navigate without full reload
            window.history.pushState({}, '', step.navigateTo);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    }, [stepIdx]);

    // Poll for equip steps: check if sword/shield is equipped
    useEffect(() => {
        const step = FLOW_STEPS[stepIdx];
        if (step?.action === 'equip' || step?.action === 'equip-shield') {
            pollRef.current = window.setInterval(async () => {
                try {
                    const res = await fetch('/api/character/me', { headers: getHeaders() });
                    if (res.ok) {
                        const char = await res.json();
                        setCharacter(char);
                        const eq = char.equipment || {};
                        if (step.action === 'equip' && eq.weapon1) {
                            clearInterval(pollRef.current);
                            await handleEquipConfirm();
                        } else if (step.action === 'equip-shield' && eq.shield) {
                            clearInterval(pollRef.current);
                            await handleEquipConfirm();
                        }
                    }
                } catch {}
            }, 1000);
            return () => clearInterval(pollRef.current);
        }
    }, [stepIdx]);

    const apiCall = async (url: string) => {
        setLoading(true);
        try {
            const res = await fetch(url, { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Ошибка');
                return null;
            }
            return data;
        } catch {
            showToast('Ошибка сервера');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const refreshChar = async () => {
        const res = await fetch('/api/character/me', { headers: getHeaders() });
        if (res.ok) setCharacter(await res.json());
    };

    const advance = () => setStepIdx(prev => prev + 1);

    const handleAction = async () => {
        const step = FLOW_STEPS[stepIdx];
        switch (step.action) {
            case 'pve': {
                const data = await apiCall('/api/tutorial/pve');
                if (!data) return;
                await refreshChar();
                advance();
                break;
            }
            case 'craft': {
                const data = await apiCall('/api/tutorial/craft');
                if (!data) return;
                await refreshChar();
                // Navigate back to home
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
                navigatedRef.current = false;
                advance();
                break;
            }
            case 'arena': {
                const data = await apiCall('/api/tutorial/arena');
                if (!data) return;
                await refreshChar();
                advance();
                break;
            }
            case 'complete': {
                const data = await apiCall('/api/tutorial/complete');
                if (!data) return;
                showToast(`Обучение пройдено! +${data.reward} серебра`, 'success');
                await refreshChar();
                onComplete();
                break;
            }
            case 'navigate-craft': {
                // Just navigate — the next step handles craft
                navigatedRef.current = true;
                window.history.pushState({}, '', '/craft');
                window.dispatchEvent(new PopStateEvent('popstate'));
                // Short delay to let React re-render the craft page, then advance
                setTimeout(() => advance(), 500);
                break;
            }
            // 'equip' and 'equip-shield' are handled by the poll effect
        }
    };

    const handleEquipConfirm = async () => {
        const step = FLOW_STEPS[stepIdx];
        const endpoint = step.action === 'equip' ? '/api/tutorial/equip' : '/api/tutorial/equip-shield';
        await apiCall(endpoint);
        await refreshChar();
        advance();
    };

    const skipTutorial = () => {
        apiCall('/api/tutorial/complete').then(() => {
            refreshChar().then(() => onComplete());
        });
    };

    // Tooltip position: below target on desktop, centered at top on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
    const tooltipStyle: React.CSSProperties = targetRect ? (isMobile ? {
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 51,
        maxWidth: 'calc(100vw - 24px)',
    } : {
        position: 'absolute',
        top: targetRect.top + targetRect.height + 16 + window.scrollY,
        left: Math.max(12, targetRect.left + targetRect.width / 2 - 160),
        zIndex: 51,
        width: 320,
    }) : {};

    return createPortal(
        <div className="tutorial-overlay-root">
            {/* Dark overlay */}
            <div className="fixed inset-0 bg-black/65 z-40" onClick={(e) => e.stopPropagation()} />

            {/* Spotlight highlight ring */}
            {targetRect && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                        border: '3px solid #f59e0b',
                        borderRadius: 8,
                        boxShadow: '0 0 20px rgba(245, 158, 11, 0.5), inset 0 0 20px rgba(245, 158, 11, 0.15)',
                    }}
                />
            )}

            {/* Tooltip */}
            <div
                    style={tooltipStyle}
                    className="bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-xl p-5 shadow-2xl"
                >
                    {/* Arrow pointing up to target (desktop only) */}
                    {!isMobile && targetRect && (
                        <div
                            className="absolute w-0 h-0"
                            style={{
                                top: -12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                borderLeft: '10px solid transparent',
                                borderRight: '10px solid transparent',
                                borderBottom: '12px solid var(--color-bg-primary)',
                                filter: 'drop-shadow(0 -1px 1px rgba(0,0,0,0.3))',
                            }}
                        />
                    )}
                    <h2 className="text-base font-bold mb-2">{currentStep.title}</h2>
                    <p className="text-sm text-[var(--color-text-muted)] mb-4">{currentStep.description}</p>
                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleAction}
                            disabled={loading || currentStep.action === 'equip' || currentStep.action === 'equip-shield'}
                            className="flex-1"
                        >
                            {loading ? '...' : currentStep.buttonText}
                        </Button>
                        {stepIdx < FLOW_STEPS.length - 1 && (
                            <Button variant="ghost" size="sm" onClick={skipTutorial}>
                                Пропустить
                            </Button>
                        )}
                    </div>
                </div>
        </div>,
        document.body
    );
}
