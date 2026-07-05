import { useNavigate } from 'react-router-dom';

interface PlayerBadgeProps {
  avatar: string | null;
  username: string;
  level: number;
  gender: string;
  currentHp: number;
  maxHp: number;
  hpPct: number;
}

export default function PlayerBadge({ avatar, username, level, gender, currentHp, maxHp, hpPct }: PlayerBadgeProps) {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => navigate('/')}
      title="На главную"
    >
      <img
        src={avatar || (gender === 'female' ? '/character_woman.webp' : '/character_man.webp')}
        alt=""
        className="w-6 h-6 rounded-full object-cover border border-[var(--color-border-default)] flex-shrink-0"
        onError={e => {
          const img = e.currentTarget;
          if (!img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = gender === 'female' ? '/character_woman.webp' : '/character_man.webp';
          }
        }}
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-[var(--color-text-muted)] truncate leading-none">
          {username} [{level}]
        </span>
        <div className="flex items-center gap-1">
          <div className="h-1 bg-[var(--color-bg-input)] rounded-full overflow-hidden border border-[var(--color-border-light)]" style={{ width: '70px' }}>
            <div style={{ width: `${hpPct}%` }} className="h-full bg-[var(--color-accent-danger)] rounded-full transition-[width] duration-300" />
          </div>
          <span className="text-[0.5rem] text-[var(--color-text-muted)] tabular-nums leading-none flex-shrink-0">
            {currentHp}/{maxHp}
          </span>
        </div>
      </div>
    </div>
  );
}
