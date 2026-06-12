import { useState } from 'react';
import { Icon } from '@iconify/react';

interface StatsOverlayProps {
  stats: { s: number; a: number; d: number; m: number };
  compact?: boolean | 'mobile' | 'verySmall';
  baseStats?: { s: number; a: number; d: number; m: number };
  equipmentBonuses?: { s: number; a: number; d: number; m: number };
  extraStats?: { crit: number; dodge: number; counter: number; fullBlock: number };
}

const STAT_ICONS: Record<string, string> = {
  'Сила': 'game-icons:biceps',
  'Ловкость': 'game-icons:sprint',
  'Защита': 'game-icons:shield',
  'Мастерство': 'game-icons:crossed-swords',
};

const BONUS_ICONS: Record<string, string> = {
  'crit': 'game-icons:crosshair',
  'dodge': 'game-icons:dodging',
  'counter': 'game-icons:riposte',
  'fullBlock': 'game-icons:shield-reflect',
};

const BONUS_LABELS: Record<string, string> = {
  'crit': 'Крит',
  'dodge': 'Уклонение',
  'counter': 'Контрудар',
  'fullBlock': 'Блок',
};

const STAT_LABELS: Record<string, string> = {
  's': 'Сила', 'a': 'Ловкость', 'd': 'Защита', 'm': 'Мастерство',
};

export default function StatsOverlay({ stats, compact, baseStats, equipmentBonuses, extraStats }: StatsOverlayProps) {
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const iconSize = isVerySmall ? '10' : isMobile ? '10' : '14';
  const fontSize = isVerySmall ? '0.55rem' : isMobile ? '0.65rem' : '0.75rem';
  const padding = isVerySmall ? '0.1rem 0.15rem' : isMobile ? '0.15rem 0.25rem' : '0.3rem 0.5rem';

  const tdStyle = 'text-left overflow-hidden text-ellipsis whitespace-nowrap pr-[2px]';

  const hasBonuses = baseStats && equipmentBonuses;
  const bonusKeys = ['s', 'a', 'd', 'm'] as const;

  const handleFlip = () => {
    setAnimating(true);
    setTimeout(() => {
      setFlipped(!flipped);
      setTimeout(() => setAnimating(false), 50);
    }, 150);
  };

  const overlayClass = `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg z-[5] text-[var(--color-text-primary)] transition-all duration-200 ease-out ${
    animating ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
  }`;

  if (flipped && hasBonuses) {
    return (
      <div style={{ padding, fontSize }} className={overlayClass + ' bg-[var(--color-bg-card)]/95'}>
        <div className="flex items-center gap-1 mb-1">
          <Icon
            icon="mdi:swap-horizontal"
            width={iconSize} height={iconSize}
            className="cursor-pointer text-[var(--color-accent-info)] hover:text-[var(--color-text-accent)]"
            onClick={handleFlip}
          />
          <span className="text-[0.6rem] text-[var(--color-text-muted)]">Бонусы</span>
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {bonusKeys.map(key => (
              <tr key={key}>
                <td className={tdStyle}>
                  <Icon icon={STAT_ICONS[STAT_LABELS[key]]} width={iconSize} height={iconSize} className="inline mr-0.5" />
                  {STAT_LABELS[key]}
                </td>
                <td className="text-right pl-[2px] text-[var(--color-accent-success)]">
                  +{equipmentBonuses![key]}
                </td>
              </tr>
            ))}
            {extraStats && (extraStats.crit > 0 || extraStats.dodge > 0 || extraStats.counter > 0 || extraStats.fullBlock > 0) && (
              <>
                <tr><td colSpan={2}><div className="border-t border-[var(--color-border-light)] my-0.5" /></td></tr>
                {['crit','dodge','counter','fullBlock'].map(k => {
                  const v = extraStats[k as keyof typeof extraStats];
                  if (!v) return null;
                  return (
                    <tr key={k}>
                      <td className={tdStyle}>
                        <Icon icon={BONUS_ICONS[k]} width={iconSize} height={iconSize} className="inline mr-0.5 text-[var(--color-accent-purple)]" />
                        {BONUS_LABELS[k]}
                      </td>
                      <td className="text-right pl-[2px] text-[var(--color-accent-purple)]">+{v}%</td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const rows = [
    ['Сила', stats.s],
    ['Ловкость', stats.a],
    ['Защита', stats.d],
    ['Мастерство', stats.m],
  ];

  return (
    <div style={{ padding, fontSize }} className={overlayClass + ' bg-[var(--color-bg-card)]/70'}>
      {hasBonuses && (
        <div className="flex justify-end mb-0.5">
          <Icon
            icon="mdi:swap-horizontal"
            width={iconSize} height={iconSize}
            className="cursor-pointer text-[var(--color-accent-info)] hover:text-[var(--color-text-accent)]"
            onClick={handleFlip}
          />
        </div>
      )}
      <table className="w-full border-collapse">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className={tdStyle}>
                <Icon icon={STAT_ICONS[label]} width={iconSize} height={iconSize} className="inline mr-0.5" />
              </td>
              <td className="text-right pl-[2px]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
