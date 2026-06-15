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

function BattleLog({ log, player1, player2, onClose }: { log: any; player1: string; player2: string; onClose: () => void }) {
  if (!log) return null;
  
  let steps: any[] = [];
  try {
    steps = typeof log === 'string' ? JSON.parse(log) : (Array.isArray(log) ? log : []);
  } catch { steps = []; }
  if (!Array.isArray(steps)) return null;

  // Track HP through the battle
  let hp1 = 100, hp2 = 100;
  let maxHp1 = 100, maxHp2 = 100;

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
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-4 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl mx-2" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm">⚔️ {player1} vs {player2}</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none cursor-pointer">✕</button>
        </div>
        
        {/* HP bars */}
        <div className="flex gap-3 mb-2 text-[0.6rem]">
          <div className="flex-1">
            <div className="text-[var(--color-text-muted)]">{player1}</div>
            <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-success)] rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-[var(--color-text-muted)]">{player2}</div>
            <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-danger)] rounded-full ml-auto" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
        
        <div className="space-y-0">
          {steps.map((s: any, i: number) => (
            <div key={i} className={`py-1 ${i > 0 ? 'border-t border-[var(--color-border-light)]' : ''}`}>
              <p className={`text-xs ${typeStyles[s.type] || 'text-[var(--color-text-muted)]'}`}>
                {s.message || JSON.stringify(s)}
              </p>
              {s.damage != null && (
                <p className="text-[0.55rem] text-[var(--color-text-muted)]">
                  Урон: {s.damage}
                  {s.actor && s.target && (
                    <span> ({s.actor === 'attacker' ? player1 : player2} → {s.target === 'attacker' ? player1 : player2})</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BracketTree({ matches }: { matches: Match[] }) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  if (!matches || matches.length === 0) return null;

  const byRound: Record<number, Match[]> = {};
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="py-1">
      {selectedMatch && (
        <BattleLog 
          log={selectedMatch.log} 
          player1={selectedMatch.player1Name || '???'} 
          player2={selectedMatch.player2Name || '???'}
          onClose={() => setSelectedMatch(null)} 
        />
      )}
      
      {/* Groups by round */}
      {rounds.map(r => {
        const label = r === rounds[rounds.length - 1] ? '🏆 Финал' 
          : r === rounds[rounds.length - 2] ? 'Полуфинал' 
          : `Раунд ${r}`;
        const matchesInRound = byRound[r] || [];
        const cols = matchesInRound.length <= 4 ? matchesInRound.length : Math.min(4, Math.ceil(matchesInRound.length / 2));
        
        return (
          <div key={r} className="mb-2">
            <div className="text-[0.6rem] text-[var(--color-text-muted)] mb-1 ml-1">{label}</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {matchesInRound.map(m => (
                <div key={m.id} 
                  className={`bg-[var(--color-bg-card)] border rounded px-2 py-1 text-[0.65rem] cursor-pointer hover:border-[var(--color-accent-info)] transition-colors ${
                    m.log ? 'hover:bg-[var(--color-bg-hover)]' : 'cursor-default'
                  }`}
                  onClick={() => m.log && setSelectedMatch(m)}
                >
                  <div className={`flex justify-between gap-1 ${m.winnerId === m.player1Id ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                    <span className="truncate">{m.player1Name || 'bye'}</span>
                    {m.winnerId === m.player1Id && '🏆'}
                  </div>
                  <div className="text-[0.5rem] text-[var(--color-text-muted)] text-center">vs</div>
                  <div className={`flex justify-between gap-1 ${m.winnerId === m.player2Id ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                    <span className="truncate">{m.player2Name || 'bye'}</span>
                    {m.winnerId === m.player2Id && '🏆'}
                  </div>
                  {m.log && (
                    <div className="text-[0.55rem] text-[var(--color-accent-info)] text-center mt-0.5">📋 лог</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
