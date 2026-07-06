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
  { label: '1 место', color: '#daa520', podium: '#daa520', glow: '0 0 20px rgba(218,165,32,0.35)', height: 80 },
  { label: '2 место', color: '#708090', podium: '#708090', glow: '0 0 15px rgba(112,128,144,0.25)', height: 55 },
  { label: '3 место', color: '#8b4513', podium: '#8b4513', glow: '0 0 10px rgba(139,69,19,0.2)', height: 35 },
];

export default function Top3Podium({ players }: Top3PodiumProps) {
  const navigate = useNavigate();

  if (players.length === 0) return null;

  // Display order: 2nd(left), 1st(center), 3rd(right)
  const ordered = [
    { player: players[1] || null, medal: MEDALS[1], place: 2 },
    { player: players[0] || null, medal: MEDALS[0], place: 1 },
    { player: players[2] || null, medal: MEDALS[2], place: 3 },
  ];

  return (
    <div className="mb-6">
      {/* Wrapper matching podium + gaps width */}
      <div style={{ maxWidth: 470, margin: '0 auto', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
        <div className="flex items-end justify-center gap-3 md:gap-6" style={{ minHeight: 160 }}>
          {ordered.map(({ player, medal, place }) => (
            <div key={place} className="flex flex-col items-center" style={{ flex: '1 1 0', maxWidth: 140, minWidth: 0 }}>
              {/* Player card above podium */}
              {player ? (
                <div
                  className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform mb-1"
                  onClick={() => navigate(`/profile/${player.id}`)}
                >
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
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold text-white border border-[var(--color-bg-primary)]"
                      style={{ background: medal.color }}
                    >
                      {place}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 max-w-full">
                    <span className="text-sm flex-shrink-0">{place === 1 ? '🏆' : place === 2 ? '🥈' : '🥉'}</span>
                    <span className="text-xs font-bold truncate" style={{ color: medal.color }}>
                      {player.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                    <span>ур. {player.level}</span>
                    <span style={{ color: medal.color }}>{player.elo}</span>
                  </div>

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
                <span className="text-[0.55rem] font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {medal.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Base line — full width inside wrapper */}
        <div className="h-0.5 rounded-full" style={{ background: 'var(--color-border-light)' }} />
      </div>
    </div>
  );
}
