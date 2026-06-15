import { Icon } from '@iconify/react';

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

  // Group by round
  const byRound: Record<number, Match[]> = {};
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  if (rounds.length === 0) return null;

  const maxRound = rounds[rounds.length - 1];
  
  // Calculate layout: each match gets a vertical position
  // Round 1 matches are at positions 0, 1, 2, ...
  // Round 2 matches are between round 1 pairs, etc.
  
  // Build a tree structure: for each round, map matches to vertical positions
  const roundMatches: Match[][] = rounds.map(r => byRound[r] || []);
  
  // For round 1, position = match index * 2
  // For round 2, position = (match index * 4) + 1
  // For round 3, position = (match index * 8) + 3, etc.
  
  const totalSlots = Math.pow(2, maxRound); // 2^rounds for positioning
  const lineHeight = 32; // px per position unit

  // Assign positions to each match
  interface PositionedMatch extends Match {
    top: number;
    bot: number;
  }
  
  const positioned: PositionedMatch[][] = [];
  
  for (let ri = 0; ri < roundMatches.length; ri++) {
    const r = ri + 1; // round number (1-based)
    const step = Math.pow(2, maxRound - r + 1);
    const offset = step / 2;
    positioned[ri] = roundMatches[ri].map((m, i) => ({
      ...m,
      top: i * step * 2 + offset,
      bot: i * step * 2 + offset + step,
    }));
  }

  const svgWidth = (maxRound + 1) * 160 + 20;
  const svgHeight = totalSlots * lineHeight + 20;

  // Build SVG paths for connectors
  const paths: string[] = [];
  
  for (let ri = 0; ri < maxRound; ri++) {
    const r = ri + 1;
    const currentRound = positioned[ri];
    const nextRound = positioned[ri + 1];
    
    for (const match of currentRound) {
      const x1 = 50 + ri * 160;
      const x2 = x1 + 30;
      const x3 = x2 + 100;
      
      const y1 = match.top * lineHeight + 10;
      const y2 = match.bot * lineHeight - 10;
      const yMid = (y1 + y2) / 2;
      
      // Vertical line connecting the two players
      if (match.player1Id && match.player2Id) {
        paths.push(`M${x2},${y1} L${x2},${y2}`);
      }
      // Horizontal from left to vertical
      if (match.player1Id) {
        paths.push(`M${x1},${y1 - 6} L${x2},${y1 - 6}`);
      }
      if (match.player2Id) {
        paths.push(`M${x1},${y2 + 6} L${x2},${y2 + 6}`);
      }
      // Connector to next round
      const nextX = 50 + (ri + 1) * 160;
      if (match.winnerId && ri < maxRound - 1) {
        // Horizontal from vertical mid to next column
        paths.push(`M${x2},${yMid} L${nextX},${yMid}`);
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="text-[var(--color-text-primary)]" style={{ minWidth: svgWidth }}>
        {/* Connector lines */}
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="var(--color-border-default)" strokeWidth="1.5" fill="none" />
        ))}
        
        {/* Match nodes */}
        {positioned.map((round, ri) =>
          round.map((match, mi) => {
            const x = 50 + ri * 160;
            const yTop = match.top * lineHeight + 3;
            const yBot = match.bot * lineHeight - 3;
            const col = 28 + ri * 2; // column offset adjusts with round
            
            return (
              <g key={`${ri}-${mi}`}>
                {/* Top player */}
                {match.player1Id && (
                  <>
                    <rect x={x - col/2} y={yTop - 7} width={110 + ri * 10} height={15} rx={3}
                      fill={match.winnerId === match.player1Id ? 'var(--color-accent-success)' : 'var(--color-bg-card)'}
                      stroke={match.winnerId === match.player1Id ? 'var(--color-accent-success)' : 'var(--color-border-default)'}
                      strokeWidth="1"
                      opacity={match.winnerId === match.player1Id ? 0.2 : 0.8}
                    />
                    <text x={x - col/2 + 5} y={yTop + 4} fontSize="9" fill="var(--color-text-primary)">
                      {match.player1Name}
                    </text>
                    {match.winnerId === match.player1Id && (
                      <text x={x + 110 + ri * 10 - 15} y={yTop + 4} fontSize="9" fill="var(--color-accent-success)">🏆</text>
                    )}
                  </>
                )}
                {!match.player1Id && (
                  <text x={x - col/2 + 5} y={yTop + 4} fontSize="9" fill="var(--color-text-muted)" opacity={0.5}>bye</text>
                )}
                
                {/* Bottom player */}
                {match.player2Id && (
                  <>
                    <rect x={x - col/2} y={yBot - 8} width={110 + ri * 10} height={15} rx={3}
                      fill={match.winnerId === match.player2Id ? 'var(--color-accent-success)' : 'var(--color-bg-card)'}
                      stroke={match.winnerId === match.player2Id ? 'var(--color-accent-success)' : 'var(--color-border-default)'}
                      strokeWidth="1"
                      opacity={match.winnerId === match.player2Id ? 0.2 : 0.8}
                    />
                    <text x={x - col/2 + 5} y={yBot + 4} fontSize="9" fill="var(--color-text-primary)">
                      {match.player2Name}
                    </text>
                    {match.winnerId === match.player2Id && (
                      <text x={x + 110 + ri * 10 - 15} y={yBot + 4} fontSize="9" fill="var(--color-accent-success)">🏆</text>
                    )}
                  </>
                )}
                {!match.player2Id && (
                  <text x={x - col/2 + 5} y={yBot + 4} fontSize="9" fill="var(--color-text-muted)" opacity={0.5}>bye</text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
