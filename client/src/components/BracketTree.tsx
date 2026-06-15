import { useState } from 'react';

interface Match {
  id: number;
  round: number;
  player1Name: string | null;
  player2Name: string | null;
  winnerName: string | null;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  log?: any;
}

function BattleLog({ log, onClose }: { log: any; onClose: () => void }) {
  if (!log) return null;
  
  let steps: any[] = [];
  try {
    steps = typeof log === 'string' ? JSON.parse(log) : (Array.isArray(log) ? log : log.steps || []);
  } catch { steps = []; }
  
  if (!Array.isArray(steps)) steps = steps.steps || steps.log || [];
  if (!Array.isArray(steps)) return null;

  const typeStyles: Record<string, string> = {
    info: 'text-[var(--color-text-muted)]',
    attack: 'text-[var(--color-accent-danger)]',
    damage: 'text-[var(--color-accent-warning)]',
    crit: 'text-[var(--color-accent-danger)] font-bold',
    dodge: 'text-[var(--color-accent-info)]',
    counter: 'text-[var(--color-accent-purple)]',
    fullBlock: 'text-[var(--color-accent-success)] font-bold',
    end: 'text-[var(--color-accent-success)] font-bold',
    money: 'text-[var(--color-accent-warning)]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-4 max-w-md w-full max-h-[70vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm">⚔️ Лог боя</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none cursor-pointer">✕</button>
        </div>
        <div className="space-y-0.5 text-xs">
          {steps.map((s: any, i: number) => (
            <p key={i} className={typeStyles[s.type] || 'text-[var(--color-text-muted)]'}>
              {s.message || JSON.stringify(s)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BracketTree({ matches }: { matches: Match[] }) {
  const [selectedLog, setSelectedLog] = useState<any>(null);
  
  if (!matches || matches.length === 0) return null;

  const byRound: Record<number, Match[]> = {};
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  // For small brackets (≤4 rounds/16 players), stack vertically
  const isCompact = rounds.length <= 4 && matches.length <= 15;
  
  if (isCompact) {
    // Vertical layout: rounds as sections
    return (
      <div className="space-y-3 py-1">
        {selectedLog && <BattleLog log={selectedLog} onClose={() => setSelectedLog(null)} />}
        {rounds.map(r => (
          <div key={r}>
            <div className="text-[0.6rem] text-[var(--color-text-muted)] mb-1">
              {r === rounds[rounds.length - 1] ? '🏆 Финал' : r === rounds[rounds.length - 2] ? 'Полуфинал' : `Раунд ${r}`}
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))` }}>
              {byRound[r].map(m => (
                <div key={m.id} 
                  className={`bg-[var(--color-bg-card)] border rounded px-2 py-1 text-[0.65rem] cursor-pointer hover:border-[var(--color-accent-info)] transition-colors ${
                    m.log ? 'hover:bg-[var(--color-bg-hover)]' : ''
                  }`}
                  onClick={() => m.log && setSelectedLog(m.log)}
                >
                  <div className={`flex justify-between ${m.winnerId === m.player1Id ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                    <span className="truncate">{m.player1Name || 'bye'}</span>
                    {m.winnerId === m.player1Id && '🏆'}
                  </div>
                  <div className={`flex justify-between ${m.winnerId === m.player2Id ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                    <span className="truncate">{m.player2Name || 'bye'}</span>
                    {m.winnerId === m.player2Id && '🏆'}
                  </div>
                  {m.log && (
                    <div className="text-[0.5rem] text-[var(--color-accent-info)] mt-0.5">📋 лог боя</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Wide layout for large brackets
  return (
    <div className="overflow-x-auto py-1">
      {selectedLog && <BattleLog log={selectedLog} onClose={() => setSelectedLog(null)} />}
      <div className="flex gap-1 min-w-max">
        {rounds.map(r => (
          <div key={r} className="flex flex-col shrink-0" style={{ width: 120 }}>
            <div className="text-[0.55rem] text-[var(--color-text-muted)] text-center mb-1">
              {r === rounds[rounds.length - 1] ? 'Финал' : r === rounds[rounds.length - 2] ? '1/2' : `1/${Math.pow(2, rounds.length - r)}`}
            </div>
            <div className="flex flex-col" style={{ gap: Math.pow(2, rounds.length - r) * 8 - 8 }}>
              {byRound[r].map(m => (
                <div key={m.id} 
                  className={`bg-[var(--color-bg-card)] border rounded px-1.5 py-0.5 text-[0.6rem] cursor-pointer hover:border-[var(--color-accent-info)] ${
                    m.log ? 'hover:bg-[var(--color-bg-hover)]' : ''
                  }`}
                  onClick={() => m.log && setSelectedLog(m.log)}
                >
                  <div className={`truncate ${m.winnerId === m.player1Id ? 'text-[var(--color-accent-success)] font-bold' : ''}`}>
                    {m.player1Name || 'bye'}{m.winnerId === m.player1Id ? ' 🏆' : ''}
                  </div>
                  <div className={`truncate ${m.winnerId === m.player2Id ? 'text-[var(--color-accent-success)] font-bold' : ''}`}>
                    {m.player2Name || 'bye'}{m.winnerId === m.player2Id ? ' 🏆' : ''}
                  </div>
                  {m.log && <div className="text-[0.5rem] text-[var(--color-accent-info)]">лог</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
