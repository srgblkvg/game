import { useEffect, useState, useRef } from 'react';

interface Props {
    result: { success: boolean; label: string };
    onDone: () => void;
}

export default function CraftPopup({ result, onDone }: Props) {
    const [phase, setPhase] = useState<'fill' | 'result' | 'done'>('fill');
    const [progress, setProgress] = useState(0);
    // Захватываем onDone только при первом рендере, чтобы не терять замыкание
    const onDoneRef = useRef(onDone);

    // Анимация заполнения: успех — до 100%, провал — до 45%
    useEffect(() => {
        const target = result.success ? 100 : 45;
        const duration = 1800;
        const start = Date.now();
        let done = false;

        const tick = () => {
            if (done) return;
            const elapsed = Date.now() - start;
            const pct = Math.min(100, (elapsed / duration) * target);
            setProgress(pct);
            if (elapsed < duration) {
                requestAnimationFrame(tick);
            } else {
                done = true;
                setProgress(target);
                setPhase('result');
                setTimeout(() => {
                    setPhase('done');
                    onDoneRef.current();
                }, 1500);
            }
        };
        requestAnimationFrame(tick);
        return () => { done = true; };
    }, [result.success]);

    if (phase === 'done') return null;

    const barColor = result.success
        ? 'bg-[var(--color-accent-success)]'
        : progress > 20 ? 'bg-[var(--color-accent-danger)]' : 'bg-[var(--color-accent-success)]';

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl text-center">
                <p className="text-sm text-[var(--color-text-muted)] mb-3">{result.label}</p>

                {/* Прогресс-бар */}
                <div className="w-full h-4 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-border-default)]">
                    <div
                        className={`h-full rounded-full transition-none ${barColor}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Результат */}
                {phase === 'result' && (
                    <p className={`mt-3 font-bold text-lg animate-bounce ${
                        result.success
                            ? 'text-[var(--color-accent-gold)]'
                            : 'text-[var(--color-accent-danger)]'
                    }`}>
                        {result.success ? 'Успех!' : 'Провал'}
                    </p>
                )}
            </div>
        </div>
    );
}
