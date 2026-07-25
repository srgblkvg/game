import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { getHeaders } from '../api/helpers';
import Button from './ui/Button';

interface TutorialFlowProps {
    onComplete: () => void;
}

export default function TutorialFlow({ onComplete }: TutorialFlowProps) {
    const { character, setCharacter } = useGame();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(character?.tutorialStep || 0);

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

    const handlePve = async () => {
        const data = await apiCall('/api/tutorial/pve');
        if (!data) return;
        // Refresh character
        const charRes = await fetch('/api/character/me', { headers: getHeaders() });
        if (charRes.ok) setCharacter(await charRes.json());
        setStep(1);
    };

    const handleEquip = async () => {
        const data = await apiCall('/api/tutorial/equip');
        if (!data) return;
        const charRes = await fetch('/api/character/me', { headers: getHeaders() });
        if (charRes.ok) setCharacter(await charRes.json());
        setStep(2);
    };

    const handleCraft = async () => {
        const data = await apiCall('/api/tutorial/craft');
        if (!data) return;
        const charRes = await fetch('/api/character/me', { headers: getHeaders() });
        if (charRes.ok) setCharacter(await charRes.json());
        setStep(3);
    };

    const handleEquipShield = async () => {
        const data = await apiCall('/api/tutorial/equip-shield');
        if (!data) return;
        const charRes = await fetch('/api/character/me', { headers: getHeaders() });
        if (charRes.ok) setCharacter(await charRes.json());
        setStep(4);
    };

    const handleArena = async () => {
        const data = await apiCall('/api/tutorial/arena');
        if (!data) return;
        const charRes = await fetch('/api/character/me', { headers: getHeaders() });
        if (charRes.ok) setCharacter(await charRes.json());
        setStep(5);
    };

    const handleComplete = async () => {
        const data = await apiCall('/api/tutorial/complete');
        if (!data) return;
        showToast(`Обучение пройдено! +${data.reward} серебра`, 'success');
        const charRes = await fetch('/api/character/me', { headers: getHeaders() });
        if (charRes.ok) setCharacter(await charRes.json());
        onComplete();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                {step === 0 && (
                    <div className="text-center space-y-4">
                        <h2 className="text-lg font-bold">Добро пожаловать в мир!</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Начнём с первой атаки. Ты сразишься с обитателем Склепа — это безопасно, победа гарантирована.
                        </p>
                        <Button variant="primary" size="md" fullWidth onClick={handlePve} disabled={loading}>
                            {loading ? '...' : '⚔ Атаковать'}
                        </Button>
                    </div>
                )}

                {step === 1 && (
                    <div className="text-center space-y-4">
                        <h2 className="text-lg font-bold">Победа!</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Ты добыл <b>Пыль забвения</b>, <b>Меч «Стон могильщика»</b> и <b>5 монет</b>.
                        </p>
                        <p className="text-xs text-[var(--color-accent-warning)]">
                            Открой инвентарь, нажми на меч и выбери слот для экипировки. Затем нажми «Готово».
                        </p>
                        <Button variant="primary" size="md" fullWidth onClick={handleEquip} disabled={loading}>
                            {loading ? '...' : '✓ Меч надет — готово'}
                        </Button>
                    </div>
                )}

                {step === 2 && (
                    <div className="text-center space-y-4">
                        <h2 className="text-lg font-bold">Ремесло</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Из <b>Пыли забвения</b> создадим щит. Шанс успеха — 100%.
                        </p>
                        <Button variant="primary" size="md" fullWidth onClick={handleCraft} disabled={loading}>
                            {loading ? '...' : '🔨 Создать щит'}
                        </Button>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center space-y-4">
                        <h2 className="text-lg font-bold">Щит создан!</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            <b>Гробовая преграда</b> — твой первый щит. Надень его в инвентаре.
                        </p>
                        <Button variant="primary" size="md" fullWidth onClick={handleEquipShield} disabled={loading}>
                            {loading ? '...' : '✓ Щит надет — готово'}
                        </Button>
                    </div>
                )}

                {step === 4 && (
                    <div className="text-center space-y-4">
                        <h2 className="text-lg font-bold">Арена</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Испытай себя в PvP-бою против тренировочного голема.
                        </p>
                        <Button variant="primary" size="md" fullWidth onClick={handleArena} disabled={loading}>
                            {loading ? '...' : '⚔ На арену!'}
                        </Button>
                    </div>
                )}

                {step === 5 && (
                    <div className="text-center space-y-4">
                        <h2 className="text-lg font-bold">Обучение завершено!</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Ты освоил основы: бой, экипировку, крафт и PvP.
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            Пока кулдауны атак — продолжай исследовать мир самостоятельно. Удачи!
                        </p>
                        <p className="text-sm font-bold text-[var(--color-accent-gold)]">
                            Награда: 1000 серебра
                        </p>
                        <Button variant="primary" size="md" fullWidth onClick={handleComplete} disabled={loading}>
                            {loading ? '...' : '🎯 Завершить обучение'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
