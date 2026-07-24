import { useState, useEffect, useRef } from 'react';
import PageHeader from '../components/ui/PageHeader';
import BackButton from '../components/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { getHeaders } from '../api/helpers';
import { useToast } from '../contexts/ToastContext';

const STAT_CONFIG: Record<string, { label: string; icon: string; multiplier: number }> = {
    s: { label: 'Сила', icon: '💪', multiplier: 1.8 },
    a: { label: 'Ловкость', icon: '🏃', multiplier: 1.2 },
    d: { label: 'Защита', icon: '🛡️', multiplier: 1.0 },
    m: { label: 'Мастерство', icon: '🎯', multiplier: 1.5 },
};

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrainingPage() {
    const { showToast } = useToast();
    const [onCooldown, setOnCooldown] = useState(false);
    const [cooldownSec, setCooldownSec] = useState(0);
    const [costs, setCosts] = useState<Record<string, number>>({});
    const [stats, setStats] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadStatus = async () => {
        try {
            const r = await fetch('/api/training', { headers: getHeaders() });
            const d = await r.json();
            setCosts(d.costs);
            setStats(d.stats);
            setOnCooldown(d.onCooldown);
            if (d.onCooldown) {
                const sec = Math.max(0, d.cooldownUntil - Math.floor(Date.now() / 1000));
                setCooldownSec(sec);
                startTimer(sec);
            }
            setLoaded(true);
        } catch {}
    };

    const startTimer = (initialSec: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        let remaining = initialSec;
        timerRef.current = setInterval(() => {
            remaining--;
            setCooldownSec(remaining);
            if (remaining <= 0) {
                if (timerRef.current) clearInterval(timerRef.current);
                setOnCooldown(false);
                loadStatus();
            }
        }, 1000);
    };

    useEffect(() => {
        loadStatus();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const train = async (stat: string) => {
        setLoading(true);
        try {
            const r = await fetch('/api/training', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ stat }),
            });
            const d = await r.json();
            if (!r.ok) {
                if (d.error?.includes('отдохнуть')) {
                    showToast(d.error, 'warning');
                    loadStatus();
                } else {
                    showToast(d.error);
                }
                setLoading(false);
                return;
            }
            showToast(d.message, 'success');
            setStats(prev => ({ ...prev, [stat]: prev[stat]! + 1 }));
            setOnCooldown(true);
            const sec = 60 * 60;
            setCooldownSec(sec);
            startTimer(sec);
        } catch { showToast('Ошибка соединения', 'error'); }
        setLoading(false);
    };

    if (!loaded) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-4">
                <BackButton />
                <PageHeader title="Лудус" />
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Загрузка...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <BackButton />
            <PageHeader title="Лудус" />
            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-3">
                Тренируйте базовые статы. Одна тренировка в час.
            </p>

            {/* Текущие статы */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                {Object.entries(STAT_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="text-center bg-[var(--color-bg-secondary)] rounded p-2">
                        <div className="text-lg">{cfg.icon}</div>
                        <div className="text-[0.6rem] text-[var(--color-text-muted)]">{cfg.label}</div>
                        <div className="text-sm font-bold">{stats[key]}</div>
                    </div>
                ))}
            </div>

            {/* Кулдаун */}
            {onCooldown ? (
                <Card className="p-4 text-center">
                    <p className="text-sm text-[var(--color-accent-warning)] mb-2">
                        Тренировки выматывают, нужно отдохнуть
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-text-muted)]">
                        {formatTime(cooldownSec)}
                    </p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {Object.entries(STAT_CONFIG).map(([key, cfg]) => {
                        const cost = costs[key] || 0;
                        return (
                            <Card key={key} className="flex items-center gap-3 p-3">
                                <span className="text-xl">{cfg.icon}</span>
                                <div className="flex-1">
                                    <div className="text-sm font-bold">{cfg.label} +1</div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        ×{cfg.multiplier} коэффициент
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Button
                                        variant="danger"
                                        size="md"
                                        disabled={loading}
                                        onClick={() => train(key)}
                                    >
                                        {cost} сер.
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
