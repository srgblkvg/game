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

function roundLabel(r: number, totalRounds: number): string {
  const remaining = totalRounds - r + 1;
  if (remaining === 1) return '🏆 Финал';
  if (remaining === 2) return 'Полуфинал';
  if (remaining === 3) return '1/4';
  const fraction = Math.pow(2, remaining - 1);
  return `1/${fraction}`;
}

function BattleLog({ log, player1, player2, onClose }: { log: any; player1: string; player2: string; onClose: () => void }) {
  if (!log) return null;
  
  let steps: any[] = [];
  try {
    steps = typeof log === 'string' ? JSON.parse(log) : (Array.isArray(log) ? log : []);
  } catch { steps = []; }
  if (!Array.isArray(steps) || steps.length === 0) return null;

  // Find initial stats
  const initStep = steps[0];
  const stats1 = initStep?.stats1;
  const stats2 = initStep?.stats2;
  const maxHp1 = initStep?.maxHp1 || 100;
  const maxHp2 = initStep?.maxHp2 || 100;

  const typeStyles: Record<string, string> = {
    info: 'text-[var(--color-text-muted)]',
    attack: 'text-[var(--color-accent-danger)]',
    damage: 'text-[var(--color-accent-warning)]',
    crit: 'text-[var(--color-accent-danger)] font-bold',
    dodge: 'text-[var(--color-accent-info)]',
    counter: 'text-[var(--color-accent-purple)]',
    fullBlock: 'text-[var(--color-accent-success)] font-bold',
    stun: 'text-[var(--color-accent-warning)]',
    block: 'text-[var(--color-accent-info)]',
    end: 'text-[var(--color-accent-success)] font-bold',
    money: 'text-[var(--color-accent-warning)]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-4 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl mx-2" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-sm">⚔️ {player1} vs {player2}</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none cursor-pointer">✕</button>
        </div>

        {/* Character stats */}
        {stats1 && stats2 && (
          <div className="mb-2 p-2 bg-[var(--color-bg-card)] rounded text-[0.6rem]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-bold text-[var(--color-accent-success)]">{stats1.name}</div>
                <div className="text-[var(--color-text-muted)]">ур.{stats1.level} | S:{stats1.S} A:{stats1.A} D:{stats1.D} M:{stats1.M}</div>
                <div className="text-[var(--color-text-muted)]">HP: {stats1.HP}</div>
                {stats1.drinks && (stats1.drinks.s || stats1.drinks.a || stats1.drinks.d || stats1.drinks.m) ? (
                  <div className="text-[var(--color-accent-info)]">🍺 S:{stats1.drinks.s||0} A:{stats1.drinks.a||0} D:{stats1.drinks.d||0} M:{stats1.drinks.m||0}</div>
                ) : null}
                {stats1.collection ? <div className="text-[var(--color-accent-purple)]">📚 +{stats1.collection}%</div> : null}
                {stats1.guildBonus ? <div className="text-[var(--color-accent-warning)]">🏰 ×Гильдия +{stats1.guildBonus}%</div> : null}
              </div>
              <div className="text-right">
                <div className="font-bold text-[var(--color-accent-danger)]">{stats2.name}</div>
                <div className="text-[var(--color-text-muted)]">ур.{stats2.level} | S:{stats2.S} A:{stats2.A} D:{stats2.D} M:{stats2.M}</div>
                <div className="text-[var(--color-text-muted)]">HP: {stats2.HP}</div>
                {stats2.drinks && (stats2.drinks.s || stats2.drinks.a || stats2.drinks.d || stats2.drinks.m) ? (
                  <div className="text-[var(--color-accent-info)]">🍺 S:{stats2.drinks.s||0} A:{stats2.drinks.a||0} D:{stats2.drinks.d||0} M:{stats2.drinks.m||0}</div>
                ) : null}
                {stats2.collection ? <div className="text-[var(--color-accent-purple)]">📚 +{stats2.collection}%</div> : null}
                {stats2.guildBonus ? <div className="text-[var(--color-accent-warning)]">🏰 ×Гильдия +{stats2.guildBonus}%</div> : null}
              </div>
            </div>
          </div>
        )}
        
        {/* HP bars */}
        <div className="flex gap-3 mb-2 text-[0.6rem]">
          <div className="flex-1">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>{player1}</span>
              <span className="tabular-nums">{initStep?.hp1 ?? maxHp1}/{maxHp1}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-success)] rounded-full transition-all" style={{ width: `${Math.max(0, (initStep?.hp1 ?? maxHp1) / maxHp1 * 100)}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>{player2}</span>
              <span className="tabular-nums">{initStep?.hp2 ?? maxHp2}/{maxHp2}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-danger)] rounded-full transition-all" style={{ width: `${Math.max(0, (initStep?.hp2 ?? maxHp2) / maxHp2 * 100)}%` }} />
            </div>
          </div>
        </div>
        
        {/* Battle steps */}
        <div className="space-y-0">
          {steps.map((s: any, i: number) => {
            if (i === 0) return null; // Skip initial info step (already shown)
            const hasHp = s.hp1 != null || s.hp2 != null;
            return (
              <div key={i} className={`py-1 ${i > 1 ? 'border-t border-[var(--color-border-light)]' : ''}`}>
                <p className={`text-xs ${typeStyles[s.type] || 'text-[var(--color-text-muted)]'}`}>
                  {s.message || JSON.stringify(s)}
                </p>
                {s.damage != null && (
                  <p className="text-[0.55rem] text-[var(--color-text-muted)]">
                    -{s.damage} HP
                  </p>
                )}
                {hasHp && (
                  <div className="flex gap-3 mt-0.5 text-[0.55rem]">
                    <span className="text-[var(--color-accent-success)] tabular-nums">{s.hp1}/{s.maxHp1 || maxHp1}</span>
                    <span className="text-[var(--color-accent-danger)] tabular-nums ml-auto">{s.hp2}/{s.maxHp2 || maxHp2}</span>
                  </div>
                )}
              </div>
            );
          })}
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
    <div className="py-1 overflow-x-auto">
      {selectedMatch && (
        <BattleLog 
          log={selectedMatch.log} 
          player1={selectedMatch.player1Name || '???'} 
          player2={selectedMatch.player2Name || '???'}
          onClose={() => setSelectedMatch(null)} 
        />
      )}
      
      {rounds.map(r => {
        const label = roundLabel(r, rounds.length);
        const matchesInRound = byRound[r] || [];
        const cols = matchesInRound.length <= 4 ? matchesInRound.length : 4;
        
        return (
          <div key={r} className="mb-2">
            <div className="text-[0.6rem] text-[var(--color-text-muted)] mb-1 ml-1">{label}</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(120px, 1fr))` }}>
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
