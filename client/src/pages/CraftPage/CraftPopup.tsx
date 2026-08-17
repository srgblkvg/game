import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';

interface Props {
  result: { success: boolean; label: string; message?: string };
  onDone: () => void;
}

export default function CraftPopup({ result, onDone }: Props) {
  const [phase, setPhase] = useState<'fill' | 'result' | 'done'>('fill');
  const finishedRef = useRef(false);
  const revealTimerRef = useRef(0);
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
    revealTimerRef.current = window.setTimeout(() => {
      setPhase('result');
      resultTimerRef.current = window.setTimeout(finish, 1500);
    }, 1800);
    return () => { window.clearTimeout(revealTimerRef.current); window.clearTimeout(resultTimerRef.current); };
  }, [result.success]);

  const skip = () => {
    if (finishedRef.current) return;
    window.clearTimeout(revealTimerRef.current);
    window.clearTimeout(resultTimerRef.current);
    setPhase('result');
    resultTimerRef.current = window.setTimeout(finish, 120);
  };

  if (phase === 'done') return null;
  const barColor = phase === 'result'
    ? result.success ? 'bg-[var(--color-accent-success)]' : 'bg-[var(--color-accent-danger)]'
    : 'bg-[var(--color-accent-purple)]';

  return <div className="fixed inset-0 z-[1100] flex items-center justify-center">
    <style>{`@keyframes craft-single-progress { from { width: 0%; } to { width: 100%; } }`}</style>
    <div className="absolute inset-0 bg-black/50" />
    <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl text-center">
      <p className="text-sm text-[var(--color-text-muted)] mb-3">{result.label}</p>
      <div className="w-full h-4 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-border-default)]">
        <div className={`h-full rounded-full ${barColor}`} style={phase === 'fill' ? { animation: 'craft-single-progress 1800ms linear forwards' } : { width: '100%' }} />
      </div>
      {phase === 'result' && <>
        <p className={`mt-3 font-bold text-lg animate-bounce ${result.success ? 'text-[var(--color-accent-gold)]' : 'text-[var(--color-accent-danger)]'}`}>{result.success ? 'Успех!' : 'Провал'}</p>
        {result.message && <p className="mt-2 text-sm text-[var(--color-text-primary)]">{result.message}</p>}
      </>}
      <Button className="mt-4" size="sm" variant="secondary" onClick={skip}>Пропустить</Button>
    </div>
  </div>;
}
