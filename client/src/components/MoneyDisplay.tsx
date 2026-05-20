const goldColor = '#f1c40f';
const silverColor = '#bdc3c7';
const bronzeColor = '#e67e22';

function Coin({ color, value }: { color: string; value: number }) {
    if (value === 0) return null;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '2px', fontSize: '0.85rem', color: '#fff' }}>
            <span>{value}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="11" stroke="#000" strokeWidth="1" />
            </svg>
        </span>
    );
}

export function MoneyDisplay({ money }: { money: number }) {
    if (money === 0) {
        return (
            <span style={{ fontWeight: 'bold' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '2px', fontSize: '0.85rem', color: '#fff' }}>
                    <span>0</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={bronzeColor} style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="11" stroke="#000" strokeWidth="1" />
                    </svg>
                </span>
            </span>
        );
    }

    const gold = Math.floor(money / 10000);
    const silver = Math.floor((money % 10000) / 100);
    const bronze = money % 100;

    return (
        <span style={{ fontWeight: 'bold' }}>
            <Coin color={goldColor} value={gold} />
            <Coin color={silverColor} value={silver} />
            <Coin color={bronzeColor} value={bronze} />
        </span>
    );
}