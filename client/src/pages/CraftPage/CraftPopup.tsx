import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';

interface Props {
  result: { success: boolean; label: string };
  onDone: () => void;
}

export default function CraftPopup({ result, onDone }: Props) {
  const [phase, setPhase] = useState<'fill' | 'result' | 'done'>('fill');
  const [progress, setProgress] = useState(0);
  const finishedRef = useRef(false);
  const frameRef = useRef(0);
  const resultTimerRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('done');
    onDoneRef.current();
  };

  useEffect(() => {
    finishedRef.current = false;
    const target = result.success ? 100 : 45;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      setProgress(Math.min(target, (elapsed / 1800) * target));
      if (elapsed < 1800) frameRef.current = requestAnimationFrame(tick);
      else {
        setProgress(target);
        setPhase('result');
        resultTimerRef.current = window.setTimeout(finish, 1500);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameRef.current); window.clearTimeout(resultTimerRef.current); };
  }, [result.success]);

  const skip = () => {
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(resultTimerRef.current);
    setProgress(result.success ? 100 : 45);
    setPhase('result');
    window.setTimeout(finish, 120);
  };

  if (phase === 'done') return null;
  const barColor = result.success ? 'bg-[var(--color-accent-success)]' : progress > 20 ? 'bg-[var(--color-accent-danger)]' : 'bg-[var(--color-accent-success)]';

  return <div className="fixed inset-0 z-[1100] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" />
    <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl text-center">
      <p className="text-sm text-[var(--color-text-muted)] mb-3">{result.label}</p>
      <div className="w-full h-4 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-border-default)]">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
      </div>
      {phase === 'result' && <p className={`mt-3 font-bold text-lg animate-bounce ${result.success ? 'text-[var(--color-accent-gold)]' : 'text-[var(--color-accent-danger)]'}`}>{result.success ? 'Успех!' : 'Провал'}</p>}
      <Button className="mt-4" size="sm" variant="secondary" onClick={skip}>Пропустить</Button>
    </div>
  </div>;
}
