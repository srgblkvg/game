interface StatsOverlayProps {
  stats: { s: number; a: number; d: number; m: number };
  compact?: boolean | 'mobile' | 'verySmall';
}

export default function StatsOverlay({ stats, compact }: StatsOverlayProps) {
  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const fontSize = isVerySmall ? '0.5rem' : isMobile ? '0.65rem' : '0.8rem';
  const maxWidth = isVerySmall ? '38px' : isMobile ? '46px' : '60px';
  const padding = isVerySmall ? '0.15rem 0.2rem' : isMobile ? '0.2rem 0.3rem' : '0.4rem 0.6rem';

  const tdStyle = {
    textAlign: 'left' as const,
    maxWidth,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    paddingRight: '6px',
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
              <td style={tdStyle}>{label}</td>
              <td style={{ textAlign: 'right' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
