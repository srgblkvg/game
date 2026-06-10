import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useGame } from '../contexts/GameContext';
import { allocateStats, fetchCharacter } from '../api/character';
import Button from './ui/Button';
import Card from './ui/Card';

const STATS = [
  { key: 's' as const, label: 'Сила', icon: 'game-icons:biceps', color: 'var(--color-accent-danger)', desc: 'Урон в атаке' },
  { key: 'a' as const, label: 'Ловкость', icon: 'game-icons:sprint', color: 'var(--color-accent-success)', desc: 'Уклонение, очерёдность хода' },
  { key: 'd' as const, label: 'Защита', icon: 'game-icons:shield', color: 'var(--color-accent-info)', desc: 'Шанс и сила блока' },
  { key: 'm' as const, label: 'Мастерство', icon: 'game-icons:crossed-swords', color: 'var(--color-accent-purple)', desc: 'Крит, контратака, оглушение' },
];

export default function StatAllocation() {
  const { character, setCharacter } = useGame();
  const [spending, setSpending] = useState(false);
  const [allocated, setAllocated] = useState<Record<string, number>>({});

  if (!character || character.statPoints <= 0) return null;

  const stats = character.stats || { s: 0, a: 0, d: 0, m: 0 };
  const remainingPoints = character.statPoints - Object.values(allocated).reduce((a, b) => a + b, 0);

  const handleAdd = (key: string) => {
    if (remainingPoints <= 0) return;
    setAllocated(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const handleRemove = (key: string) => {
    if (!allocated[key]) return;
    setAllocated(prev => ({ ...prev, [key]: prev[key] - 1 || 0 }));
  };

  const handleSubmit = async () => {
    setSpending(true);
    try {
      const result = await allocateStats(allocated);
      setAllocated({});
      setCharacter(result);
    } catch (e: any) {
      alert(e.message || 'Ошибка распределения очков');
    } finally {
      setSpending(false);
    }
  };

  return (
    <Card className="mb-4">
      <h3 className="text-sm mb-3">Распределение очков ({character.statPoints})</h3>
      {STATS.map(stat => {
        const current = stats[stat.key] || 0;
        const extra = allocated[stat.key] || 0;
        const total = current + extra;
        return (
          <div key={stat.key} className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Icon icon={stat.icon} width="14" height="14" style={{ color: stat.color }} />
                <span className="text-xs">{stat.label}: {total}</span>
                {extra > 0 && <span className="text-xs" style={{ color: stat.color }}> (+{extra})</span>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleRemove(stat.key)}
                  disabled={!allocated[stat.key]}
                  className="px-1.5 py-0.5 text-xs rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] cursor-pointer disabled:opacity-30"
                >-</button>
                <button
                  onClick={() => handleAdd(stat.key)}
                  disabled={remainingPoints <= 0}
                  className="px-1.5 py-0.5 text-xs rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] cursor-pointer disabled:opacity-30"
                >+</button>
              </div>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-input)] rounded overflow-hidden">
              <div
                className="h-full rounded transition-[width] duration-300"
                style={{ width: `${Math.min(100, (total / 100) * 100)}%`, backgroundColor: stat.color }}
              />
            </div>
          </div>
        );
      })}
      {Object.values(allocated).some(v => v > 0) && (
        <Button
          onClick={handleSubmit}
          disabled={spending || remainingPoints > 0}
          variant="primary"
          size="sm"
          className="mt-2 w-full"
        >
          {spending ? 'Сохраняем...' : 'Применить'}
        </Button>
      )}
    </Card>
  );
}
