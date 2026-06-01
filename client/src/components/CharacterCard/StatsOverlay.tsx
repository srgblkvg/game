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

  const tdStyle = {
    textAlign: 'left' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    paddingRight: '2px',
  };

  const rows = [
    ['Сила', stats.s],
    ['Ловкость', stats.a],
    ['Защита', stats.d],
    ['Мастерство', stats.m],
  ];

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.7)',
      padding, borderRadius: '8px',
      zIndex: 1, color: '#eee',
      fontSize, lineHeight: '1.2',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={tdStyle}>
                <Icon icon={STAT_ICONS[label]} width={iconSize} height={iconSize} className="inline mr-0.5" />
              </td>
              <td style={{ textAlign: 'right', paddingLeft: '2px' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
