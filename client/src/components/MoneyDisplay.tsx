const silverColor = '#bdc3c7';

export function MoneyDisplay({ money }: { money: number }) {
    return (
        <span style={{ fontWeight: 'bold' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '2px', fontSize: '0.85rem', color: '#fff' }}>
                <span>{money.toLocaleString()}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={silverColor} style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="11" stroke="#000" strokeWidth="1" />
                </svg>
            </span>
        </span>
    );
}
