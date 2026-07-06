import { useNavigate } from 'react-router-dom';
import GuildTag from './GuildTag';

interface Player {
  id: number;
  username: string;
  level: number;
  elo: number;
  avatar: string | null;
  gender: string;
  guildName: string | null;
  guildId: number | null;
  rank?: { name: string; icon: string; color: string };
}

interface Top3PodiumProps {
  players: Player[];
}

const MEDALS = [
  { label: '1 место', color: '#b8860b', bg: '#b8860b18', border: '#b8860b50', podium: '#b8860b', glow: '0 0 20px rgba(184,134,11,0.3)', height: 120 },
  { label: '2 место', color: '#708090', bg: '#70809018', border: '#70809050', podium: '#708090', glow: '0 0 15px rgba(112,128,144,0.25)', height: 90 },
  { label: '3 место', color: '#8b4513', bg: '#8b451318', border: '#8b451350', podium: '#8b4513', glow: '0 0 10px rgba(139,69,19,0.2)', height: 60 },
];

export default function Top3Podium({ players }: Top3PodiumProps) {
  const navigate = useNavigate();

  if (players.length === 0) return null;

  // Display order: 2nd(left), 1st(center), 3rd(right)
  const ordered = [
    { player: players[1] || null, medal: MEDALS[1], place: 2 }, // silver — left
    { player: players[0] || null, medal: MEDALS[0], place: 1 }, // gold — center
    { player: players[2] || null, medal: MEDALS[2], place: 3 }, // bronze — right
  ];

  return (
    <div className="mb-6">
      <div className="flex items-end justify-center gap-3 md:gap-6 px-2" style={{ minHeight: 200 }}>
        {ordered.map(({ player, medal, place }) => (
          <div key={place} className="flex flex-col items-center" style={{ flex: '0 0 auto', width: '30%', maxWidth: 140 }}>
            {/* Player card above podium */}
            {player ? (
              <div
                className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform mb-1"
                onClick={() => navigate(`/profile/${player.id}`)}
              >
                {/* Avatar with medal-colored border */}
                <div
                  className="relative rounded-full p-0.5 mb-1"
                  style={{ background: medal.color, boxShadow: medal.glow }}
                >
                  <img
                    src={player.avatar || (player.gender === 'female' ? '/character_woman.webp' : '/character_man.webp')}
                    alt=""
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-[var(--color-bg-primary)]"
                    onError={e => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = player.gender === 'female' ? '/character_woman.webp' : '/character_man.webp';
                      }
                    }}
                  />
                  {/* Place badge */}
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold text-white border border-[var(--color-bg-primary)]"
                    style={{ background: medal.color }}
                  >
                    {place}
                  </div>
                </div>

                {/* Trophy before nickname */}
                <div className="flex items-center gap-0.5 max-w-full">
                  <span className="text-sm flex-shrink-0">{place === 1 ? '🏆' : place === 2 ? '🥈' : '🥉'}</span>
                  <span
                    className="text-xs font-bold truncate"
                    style={{ color: medal.color }}
                  >
                    {player.username}
                  </span>
                </div>

                {/* Level + ELO */}
                <div className="flex items-center gap-2 text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                  <span>ур. {player.level}</span>
                  <span style={{ color: medal.color }}>{player.elo}</span>
                </div>

                {/* Guild tag */}
                {player.guildName && (
                  <div className="mt-0.5">
                    <GuildTag guildName={player.guildName} guildId={player.guildId} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center mb-1 opacity-30">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[var(--color-bg-input)] border border-dashed border-[var(--color-border-light)] flex items-center justify-center text-lg">?</div>
                <span className="text-[0.6rem] text-[var(--color-text-muted)] mt-1">—</span>
              </div>
            )}

            {/* Podium block */}
            <div
              className="w-full rounded-t-md flex items-end justify-center pb-1"
              style={{
                height: medal.height,
                background: medal.podium,
                opacity: player ? 1 : 0.3,
              }}
            >
              <span className="text-[0.55rem] font-bold text-white/90">{medal.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Base line — same width as podiums */}
      <div className="flex justify-center" style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
        <div className="h-0.5 rounded-full" style={{ width: '100%', maxWidth: 420, background: 'var(--color-border-light)' }} />
      </div>
    </div>
  );
}
