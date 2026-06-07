import { Icon } from '@iconify/react';

interface StatsOverlayProps {
  stats: { s: number; a: number; d: number; m: number };
  compact?: boolean | 'mobile' | 'verySmall';
}

const STAT_ICONS: Record<string, string> = {
  'Сила': 'game-icons:biceps',
  'Ловкость': 'game-icons:sprint',
  'Защита': 'game-icons:shield',
  'Мастерство': 'game-icons:crossed-swords',
};

export default function StatsOverlay({ stats, compact }: StatsOverlayProps) {
  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const iconSize = isVerySmall ? '10' : isMobile ? '10' : '14';
  const fontSize = isVerySmall ? '0.65rem' : isMobile ? '0.65rem' : '0.8rem';
  const padding = isVerySmall ? '0.15rem 0.2rem' : isMobile ? '0.2rem 0.3rem' : '0.4rem 0.6rem';

  const tdStyle = 'text-left overflow-hidden text-ellipsis whitespace-nowrap pr-[2px]';

  const rows = [
    ['Сила', stats.s],
    ['Ловкость', stats.a],
    ['Защита', stats.d],
    ['Мастерство', stats.m],
  ];

  return (
    <div
      style={{ padding, fontSize }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 rounded-lg z-[1] text-[#eee] leading-[1.2]"
    >
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
