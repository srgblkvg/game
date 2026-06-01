interface HealthBarProps {
  currentHp: number;
  maxHp: number;
  compact?: boolean | 'mobile' | 'verySmall';
  showRegenHint?: boolean;
}

export default function HealthBar({ currentHp, maxHp, compact, showRegenHint }: HealthBarProps) {
  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const pct = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));

  const formatRegenTime = () => {
    const missing = maxHp - currentHp;
    const totalSec = missing * 10;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) return `${min} мин ${sec} сек`;
    return `${sec} сек`;
  };

  return (
    <div style={{ width: '100%', marginTop: '0.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: isVerySmall ? '0.65rem' : isMobile ? '0.75rem' : '0.85rem', marginBottom: '3px' }}>
        Здоровье: {currentHp}/{maxHp}
      </div>
      <div style={{ height: '14px', background: '#333', borderRadius: '4px', overflow: 'hidden', border: '1px solid #555' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#e74c3c', transition: 'width 0.4s ease' }} />
      </div>
      {showRegenHint && currentHp < maxHp && (
        <div style={{ fontSize: isVerySmall ? '0.55rem' : isMobile ? '0.6rem' : '0.7rem', color: '#888', marginTop: '2px' }}>
          +1 HP / 10 сек &mdash; полное через {formatRegenTime()}
        </div>
      )}
    </div>
  );
}
