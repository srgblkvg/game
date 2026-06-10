import { Icon } from "@iconify/react";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { startRandomJob, fetchCharacter } from '../api';
import { formatMoney } from '../utils/money';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { getHeaders } from '../api/helpers';

const durations = [
    { label: '10 мин', value: 600, icon: 'game-icons:stopwatch' },
    { label: '30 мин', value: 1800, icon: 'game-icons:hourglass' },
    { label: '1 час', value: 3600, icon: 'game-icons:clockwork' },
    { label: '8 часов', value: 28800, icon: 'game-icons:sundial' },
];

export default function JobsPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [remaining, setRemaining] = useState<number | null>(null);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const prevActiveJob = useRef(character?.activeJob);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
    }, [user, navigate]);

    useEffect(() => {
        const activeJob = character?.activeJob;
        if (activeJob) {
            setRemaining(Math.max(0, activeJob.endTime - Math.floor(Date.now() / 1000)));
        } else {
            setRemaining(null);
        }
    }, [character]);

    useEffect(() => {
        if (prevActiveJob.current && !character?.activeJob) navigate('/');
        prevActiveJob.current = character?.activeJob;
    }, [character?.activeJob, navigate]);

    useEffect(() => {
        if (!user) return;
        intervalRef.current = window.setInterval(() => {
            fetchCharacter().then(setCharacter).catch(console.error);
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [user, setCharacter]);

    const handleStart = async (duration: number) => {
        setLoading(true);
        setError('');
        try {
            const result = await startRandomJob(duration);
            setCharacter({
                ...character!,
                activeJob: {
                    jobId: 0,
                    name: result.jobName,
                    startTime: Math.floor(Date.now() / 1000),
                    endTime: result.endTime,
                    reward: result.reward,
                    duration: result.endTime - Math.floor(Date.now() / 1000),
                    expReward: result.expReward || 0,
                    rewardMin: result.rewardMin,
                    rewardMax: result.rewardMax,
                    background: result.background || null,
                },
            });
            setRemaining(result.endTime - Math.floor(Date.now() / 1000));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (remaining === null || remaining <= 0) return;
        const timer = setInterval(() => {
            setRemaining(prev => (prev === null || prev <= 1) ? 0 : prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [remaining]);

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h}ч ${m}м ${s}с`;
    };

    if (!user || !character) return null;

    const activeJob = character.activeJob;

    if (activeJob && remaining !== null && remaining > 0) {
        const bg = (activeJob as any).background;
        return (
            <>
            <div className="relative text-center py-8 px-4 rounded-xl overflow-hidden border-2 border-[var(--color-border-default)] min-h-[200px] flex flex-col items-center justify-center mt-6 mx-4"
                style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                {bg && <div className="absolute inset-0 bg-[var(--color-overlay-card)]" />}
                <div className="relative z-10">
                    <h2 className="text-xl font-bold mb-3"><Icon icon="game-icons:hourglass" width="18" height="18" className="inline mr-1"/>Выполняется работа</h2>
                    <p className="text-lg">{activeJob.name}</p>
                    <p className="text-[var(--color-text-secondary)]">Осталось: {formatTime(remaining)}</p>
                    <p className="text-[var(--color-text-accent)]">Награда: {formatMoney((activeJob as any).rewardMin || activeJob.reward)}–{formatMoney((activeJob as any).rewardMax || activeJob.reward)}{(activeJob as any).premiumBonus > 0 ? <span style={{color:'#f1c40f'}}> (+{(activeJob as any).premiumBonus} премиум)</span> : null}</p>
                    <p className="text-[var(--color-accent-purple)]">Опыт: +{activeJob.expReward || 0}</p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowCancel(true)}>Отменить работу</Button>
                </div>
            </div>
            <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Отменить работу?" borderColor="var(--color-border-default)">
                <p className="text-sm mb-4">Вы уверены? Награда и опыт <strong>не</strong> будут получены.</p>
                <div className="flex gap-2 justify-center">
                    <Button variant="danger" size="sm" disabled={cancelling} onClick={async () => {
                        setCancelling(true);
                        try {
                            await fetch('/api/jobs/cancel', { method: 'POST', headers: getHeaders() });
                            setCharacter({ ...character!, activeJob: null });
                            setShowCancel(false);
                            navigate('/');
                        } catch { setCancelling(false); }
                    }}>{cancelling ? '...' : 'Да, отменить'}</Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowCancel(false)}>Нет</Button>
                </div>
            </Modal>
            </>
        );
    }

    return (
        <div className="px-4 py-4 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:swap-bag" width="22" height="22" className="inline mr-2"/>Работы</h2>

            <p className="text-sm text-[var(--color-text-muted)] mb-4 text-center">
                Выберите, сколько времени готовы потратить — работа будет выбрана случайно.
            </p>

            {error && <p className="text-red-500 mb-4 text-center text-sm">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
                {durations.map(d => (
                    <Card key={d.value} className="flex flex-col items-center text-center cursor-pointer hover:border-[var(--color-accent-info)] transition-colors">
                        <Icon icon={d.icon} width="28" height="28" className="text-[var(--color-text-muted)] mb-2" />
                        <p className="font-bold text-sm mb-1">{d.label}</p>
                        <div className="text-xs text-[var(--color-text-muted)] mb-2">
                            {d.value >= 3600 ? `+${Math.floor(d.value / 3600)} XP` : '+1 XP'}
                        </div>
                        <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleStart(d.value)}
                            disabled={loading}
                            fullWidth
                        >
                            {loading ? '...' : 'Начать'}
                        </Button>
                    </Card>
                ))}
            </div>
        </div>
    );
}
