interface Match {
  id: number;
  round: number;
  player1Name: string | null;
  player2Name: string | null;
  winnerName: string | null;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
}

export default function BracketTree({ matches }: { matches: Match[] }) {
  if (!matches || matches.length === 0) return null;

  const byRound: Record<number, Match[]> = {};
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1];

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex gap-0 min-w-max items-start">
        {rounds.map((r, ri) => (
          <div key={r} className="flex flex-col shrink-0" style={{ width: r === maxRound ? 140 : 130 }}>
            {/* Round label */}
            <div className="text-[0.55rem] text-[var(--color-text-muted)] text-center mb-2">
              {r === maxRound ? 'Финал' : r === maxRound - 1 ? '1/2' : `1/${Math.pow(2, maxRound - r + 1)}`}
            </div>
            {/* Matches in this round */}
            {byRound[r].map((m, mi) => {
              // Calculate vertical spacing to align with next round
              const totalInRound = byRound[r].length;
              const gap = totalInRound <= 1 ? 0 : Math.pow(2, maxRound - r) * 20;
              
              return (
                <div key={m.id} className="flex flex-col" style={{ marginBottom: mi < totalInRound - 1 ? gap : 0 }}>
                  {/* Player 1 */}
                  <div className={`px-1.5 py-0.5 rounded-t text-[0.6rem] border border-b-0 whitespace-nowrap overflow-hidden text-ellipsis ${
                    m.winnerId === m.player1Id 
                      ? 'bg-[var(--color-accent-success)]/20 border-[var(--color-accent-success)] font-bold' 
                      : 'bg-[var(--color-bg-card)] border-[var(--color-border-light)]'
                  }`}>
                    {m.player1Name || '—'}
                    {m.winnerId === m.player1Id && ' 🏆'}
                  </div>
                  {/* Player 2 */}
                  <div className={`px-1.5 py-0.5 rounded-b text-[0.6rem] border border-t-0 whitespace-nowrap overflow-hidden text-ellipsis ${
                    m.winnerId === m.player2Id 
                      ? 'bg-[var(--color-accent-success)]/20 border-[var(--color-accent-success)] font-bold' 
                      : 'bg-[var(--color-bg-card)] border-[var(--color-border-light)]'
                  }`}>
                    {m.player2Name || '—'}
                    {m.winnerId === m.player2Id && ' 🏆'}
                  </div>
                  
                  {/* Arrow to next round */}
                  {ri < rounds.length - 1 && (
                    <div className="flex justify-end pr-0.5 -mt-1">
                      <span className="text-[0.5rem] text-[var(--color-text-muted)]">→</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
