import { useState } from 'react';
import { Icon } from '@iconify/react';
import { PRIMARY_STATS, STAT_LABELS, type StatRecord } from '../../utils/stats';

interface StatsOverlayProps {
  stats: StatRecord;
  compact?: boolean | 'mobile' | 'verySmall';
  baseStats?: { s: number; a: number; d: number; m: number };
  equipmentBonuses?: { s: number; a: number; d: number; m: number };
  extraStats?: { crit: number; dodge: number; counter: number; fullBlock: number };
  collectionBonus?: number;
  guildBonus?: number;
  buildings?: { type: string; icon: string; label: string; level: number; bonus: number }[];
  noFlip?: boolean;
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

export default function StatsOverlay({ stats, compact, baseStats, equipmentBonuses, extraStats, collectionBonus, guildBonus, buildings, noFlip }: StatsOverlayProps) {
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const iconSize = isVerySmall ? '10' : isMobile ? '10' : '14';
  const fontSize = isVerySmall ? '0.55rem' : isMobile ? '0.65rem' : '0.75rem';
  const padding = isVerySmall ? '0.1rem 0.15rem' : isMobile ? '0.15rem 0.25rem' : '0.3rem 0.5rem';

  const tdStyle = 'text-left overflow-hidden text-ellipsis whitespace-nowrap pr-[2px]';

  const hasBonuses = baseStats && equipmentBonuses;
  const hasExtra = (collectionBonus ?? 0) > 0 || (guildBonus ?? 0) > 0 || (buildings && buildings.some(b => b.bonus > 0));
  const showFlip = !noFlip && (hasBonuses || hasExtra);
  const bonusKeys = PRIMARY_STATS;

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

  if (flipped && showFlip) {
    return (
      <div style={{ padding, fontSize }} className={overlayClass + ' bg-[var(--color-bg-card)]/95'}>
        <div className="flex items-center gap-1 mb-1">
          <Icon
            icon="game-icons:expand"
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
                  // soft cap: x / (x + 300) → реальный процент
                  const pct = Math.round((v / (v + 300)) * 100);
                  return (
                    <tr key={k}>
                      <td className={tdStyle}>
                        <Icon icon={BONUS_ICONS[k]} width={iconSize} height={iconSize} className="inline mr-0.5 text-[var(--color-accent-purple)]" />
                        {BONUS_LABELS[k]}
                      </td>
                      <td className="text-right pl-[2px] text-[var(--color-accent-purple)]">+{pct}%</td>
                    </tr>
                  );
                })}
              </>
            )}
            {(collectionBonus ?? 0) > 0 && (
              <>
                <tr><td colSpan={2}><div className="border-t border-[var(--color-border-light)] my-0.5" /></td></tr>
                <tr>
                  <td className={tdStyle}>
                    <Icon icon="game-icons:book-cover" width={iconSize} height={iconSize} className="inline mr-0.5 text-[var(--color-accent-gold)]" />
                    Коллекция
                  </td>
                  <td className="text-right pl-[2px] text-[var(--color-accent-gold)]">+{collectionBonus}%</td>
                </tr>
              </>
            )}
            {(guildBonus ?? 0) > 0 && (
              <>
                <tr><td colSpan={2}><div className="border-t border-[var(--color-border-light)] my-0.5" /></td></tr>
                <tr>
                  <td className={tdStyle}>
                    <Icon icon="game-icons:castle" width={iconSize} height={iconSize} className="inline mr-0.5 text-[var(--color-accent-warning)]" />
                    Гильдия
                  </td>
                  <td className="text-right pl-[2px] text-[var(--color-accent-warning)]">+{guildBonus}%</td>
                </tr>
              </>
            )}
            {buildings && buildings.filter(b => b.bonus > 0).length > 0 && (
              <>
                <tr><td colSpan={2}><div className="border-t border-[var(--color-border-light)] my-0.5" /></td></tr>
                {buildings.filter(b => b.bonus > 0).map(b => (
                  <tr key={b.type}>
                    <td className={tdStyle}>
                      <span className="inline mr-1">{b.icon}</span>
                      {b.label}
                    </td>
                    <td className="text-right pl-[2px] text-[var(--color-accent-info)]">+{b.bonus}%</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const rows = PRIMARY_STATS.map(k => [STAT_LABELS[k], stats[k]] as const);

  return (
    <div style={{ padding, fontSize }} className={overlayClass + ' bg-[var(--color-bg-card)]/70'}>
      {showFlip && (
        <div className="flex justify-end mb-0.5">
          <Icon
            icon="game-icons:expand"
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
