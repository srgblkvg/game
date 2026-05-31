import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { allocateStats, fetchCharacter } from '../api/character';
import Button from './ui/Button';
import Card from './ui/Card';

const STATS = [
  { key: 's' as const, label: 'Сила', color: '#e74c3c', desc: 'Урон в атаке' },
  { key: 'a' as const, label: 'Ловкость', color: '#2ecc71', desc: 'Уклонение, очерёдность хода' },
  { key: 'd' as const, label: 'Защита', color: '#3498db', desc: 'Шанс и сила блока' },
  { key: 'm' as const, label: 'Мастерство', color: '#9b59b6', desc: 'Крит, контратака, оглушение' },
];

export default function StatAllocation() {
  const { character, setCharacter } = useGame();
  const [alloc, setAlloc] = useState({ s: 0, a: 0, d: 0, m: 0 });
  const [msg, setMsg] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  if (!character) return null;

  const remaining = (character.statPoints || 0) - alloc.s - alloc.a - alloc.d - alloc.m;

  const add = (key: 's' | 'a' | 'd' | 'm') => {
    if (remaining <= 0) return;
    setAlloc(prev => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const remove = (key: 's' | 'a' | 'd' | 'm') => {
    setAlloc(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
  };

  const handleApply = async () => {
    try {
      if (alloc.s + alloc.a + alloc.d + alloc.m === 0) return;
      if (remaining > 0) { setMsg('Распределите все очки'); return; }
      await allocateStats(alloc.s, alloc.a, alloc.d, alloc.m);
      const fresh = await fetchCharacter();
      setCharacter(fresh);
      setAlloc({ s: 0, a: 0, d: 0, m: 0 });
      setMsg('Применено!');
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <Card className="mt-4">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{collapsed ? '▶' : '▼'}</span>
          <h3 className="font-bold text-sm">Характеристики</h3>
        </div>
        <span className="text-xs text-[var(--color-text-accent)]">
          {character.statPoints || 0} очк.
        </span>
      </div>

      {!collapsed && (
        <div className="mt-2">
          {STATS.map(({ key, label, color, desc }) => (
            <div key={key} className="flex items-center gap-2 py-1 border-b border-[var(--color-border-light)] last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold" style={{ color }}>{label}</span>
                  <span className="text-sm font-bold text-white">
                    {(character.baseStats?.[key] ?? 5) + alloc[key]}
                    {alloc[key] > 0 && (
                      <span className="text-[0.6rem] text-[var(--color-accent-success)] ml-1">
                        +{alloc[key]}
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-[0.6rem] text-[var(--color-text-muted)]">{desc}</div>
              </div>
              {(character.statPoints || 0) > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(key); }}
                    disabled={alloc[key] <= 0}
                    className="w-5 h-5 rounded bg-[var(--color-border-default)] text-white text-xs disabled:opacity-20 cursor-pointer leading-none"
                  >−</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); add(key); }}
                    disabled={remaining <= 0}
                    className="w-5 h-5 rounded bg-[var(--color-accent-info)] text-white text-xs disabled:opacity-20 cursor-pointer leading-none"
                  >+</button>
                </div>
              )}
            </div>
          ))}

          {(character.statPoints || 0) > 0 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                Осталось: {remaining}
              </span>
              <Button
                variant="success"
                size="xs"
                onClick={(e) => { e.stopPropagation(); handleApply(); }}
                disabled={alloc.s + alloc.a + alloc.d + alloc.m === 0 || remaining > 0}
              >
                Применить
              </Button>
            </div>
          )}

          {msg && (
            <div className={`text-[0.65rem] mt-1 ${msg.includes('Применено') ? 'text-[var(--color-accent-success)]' : 'text-red-500'}`}>
              {msg}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
