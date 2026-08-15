import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';

export type OperationEntry = {
  id: string;
  name: string;
  detail?: string;
  status: 'pending' | 'active' | 'success' | 'failure' | 'stopped';
  result?: string;
};

type Props = {
  title: string;
  entries: OperationEntry[];
  stepKey: number;
  stepResults: Record<string, { success: boolean; message: string }> | null;
  stopping: boolean;
  onStepDone: () => void;
  onStop: () => void;
};

export default function OperationProgressModal({ title, entries, stepKey, stepResults, stopping, onStepDone, onStop }: Props) {
  const [showResult, setShowResult] = useState(false);
  const finishedRef = useRef(false);
  const revealTimerRef = useRef(0);
  const resultTimerRef = useRef(0);
  const onStepDoneRef = useRef(onStepDone);
  onStepDoneRef.current = onStepDone;

  useEffect(() => {
    finishedRef.current = false;
    setShowResult(false);
    if (!stepResults) return;
    revealTimerRef.current = window.setTimeout(() => {
      setShowResult(true);
      resultTimerRef.current = window.setTimeout(() => {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onStepDoneRef.current();
        }
      }, 900);
    }, 1500);
    return () => {
      window.clearTimeout(revealTimerRef.current);
      window.clearTimeout(resultTimerRef.current);
    };
  }, [stepKey, stepResults]);

  const skip = () => {
    if (!stepResults || finishedRef.current) return;
    finishedRef.current = true;
    window.clearTimeout(revealTimerRef.current);
    window.clearTimeout(resultTimerRef.current);
    setShowResult(true);
    onStepDoneRef.current();
  };

  return <div className="fixed inset-0 z-[1100] flex items-center justify-center">
    <style>{`@keyframes craft-round-progress { from { width: 0%; } to { width: 100%; } }`}</style>
    <div className="absolute inset-0 bg-black/65" />
    <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-xl p-4 sm:p-5 max-w-lg w-full mx-3 shadow-2xl">
      <h3 className="font-bold text-center mb-1">{title}</h3>
      <p className="text-[0.7rem] text-center text-[var(--color-text-muted)] mb-4">Каждая попытка выполняется отдельно. Остановка произойдёт после текущей попытки.</p>
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {entries.map(entry => {
          const active = entry.status === 'active';
          const stepResult = stepResults?.[entry.id];
          const color = entry.status === 'success' ? 'text-[var(--color-accent-success)]' : entry.status === 'failure' ? 'text-[var(--color-accent-danger)]' : entry.status === 'stopped' ? 'text-[var(--color-text-muted)]' : '';
          return <div key={entry.id} className={`rounded-lg border p-3 ${active ? 'border-[#f59e0b]' : 'border-[var(--color-border-light)]'} bg-[var(--color-bg-secondary)]`}>
            <div className="flex justify-between gap-2 text-xs"><span className="font-bold truncate">{entry.name}</span><span className={color}>{entry.detail || (entry.status === 'pending' ? 'Ожидание' : '')}</span></div>
            {active && <>
              <div className="h-3 mt-2 rounded-full overflow-hidden bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
                <div key={`${entry.id}-${stepKey}`} className={`h-full ${showResult && stepResult
                  ? stepResult.success ? 'bg-[var(--color-accent-success)]' : 'bg-[var(--color-accent-danger)]'
                  : 'bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#f59e0b]'} ${!stepResult ? 'animate-pulse' : ''}`}
                  style={stepResult && !showResult ? { animation: 'craft-round-progress 1500ms linear forwards' } : { width: showResult ? '100%' : '4%' }} />
              </div>
              {showResult && stepResult && <p className={`text-xs font-bold mt-2 ${stepResult.success ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>{stepResult.message}</p>}
            </>}
            {!active && entry.result && <p className={`text-[0.7rem] mt-1 ${color}`}>{entry.result}</p>}
          </div>;
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button size="md" variant="secondary" disabled={!stepResults} onClick={skip}>Пропустить анимацию</Button>
        <Button size="md" variant="danger" disabled={stopping} onClick={onStop}>{stopping ? 'Останавливаем…' : 'Остановить процесс'}</Button>
      </div>
    </div>
  </div>;
}
