import { useNavigate } from 'react-router-dom';

interface HealthBarProps {
  currentHp: number;
  maxHp: number;
  compact?: boolean | 'mobile' | 'verySmall';
  showRegenHint?: boolean;
  regenRate?: number;
  showHealButton?: boolean;
}

export default function HealthBar({ currentHp, maxHp, compact, showRegenHint, regenRate = 1, showHealButton = true }: HealthBarProps) {
  const navigate = useNavigate();
  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const pct = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));

  const formatRegenTime = () => {
    const missing = maxHp - currentHp;
    const totalSec = (missing / regenRate) * 10;
    const min = Math.floor(totalSec / 60);
    const sec = Math.round(totalSec % 60);
    if (min > 0) return `${min} мин ${sec} сек`;
    return `${sec} сек`;
  };

  const labelFontSize = isVerySmall ? 'text-[0.65rem]' : isMobile ? 'text-xs' : 'text-[0.85rem]';
  const hintFontSize = isVerySmall ? 'text-[0.55rem]' : isMobile ? 'text-[0.6rem]' : 'text-[0.7rem]';

  return (
    <div className="w-full mt-2 text-center">
      <div className={`${labelFontSize} mb-[3px]`}>
        Здоровье: {currentHp}/{maxHp}
      </div>
      <div className="h-[14px] bg-[var(--color-bg-input)] rounded overflow-hidden border border-[var(--color-border-light)] relative">
        <div style={{ width: `${pct}%` }} className="h-full bg-[var(--color-accent-danger)] transition-[width] duration-400 ease-in-out" />
        {showHealButton && currentHp < maxHp && (
          <div
            className="absolute top-0 right-0 h-full flex items-center justify-center cursor-pointer hover:text-[var(--color-accent-success)] text-[var(--color-text-muted)] px-1 text-xs font-bold select-none"
            onClick={e => { e.stopPropagation(); navigate('/tavern?tab=heal'); }}
            title="Лечение в трактире"
          >+</div>
        )}
      </div>
      {showRegenHint && currentHp < maxHp && (
        <div className={`${hintFontSize} text-[var(--color-text-muted)] mt-[2px]`}>
          +{regenRate} HP / 10 сек &mdash; полное через {formatRegenTime()}
        </div>
      )}
    </div>
  );
}
