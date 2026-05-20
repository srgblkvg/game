import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchShopItems, buyItem } from '../api';
import { formatMoney } from '../utils/money';
import { getRarityColor } from '../utils/itemUtils';
import ItemTooltip from '../components/ItemTooltip';

const rarityNames = ['Серый', 'Белый', 'Зелёный', 'Синий', 'Фиолетовый', 'Жёлтый', 'Красный'];

// Точные слоты для фильтрации
const filterSlots = [
    { value: 'all', label: 'Все' },
    { value: 'weapon1', label: 'Оружие' },
    { value: 'weapon2', label: 'Щит' },
    { value: 'ring', label: 'Кольцо' },
    { value: 'helmet', label: 'Шлем' },
    { value: 'chest', label: 'Нагрудник' },
    { value: 'gloves', label: 'Перчатки' },
    { value: 'boots', label: 'Ботинки' },
    { value: 'amulet', label: 'Амулет' },
    { value: 'belt', label: 'Пояс' },
];

export default function ShopPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [filterSlot, setFilterSlot] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchShopItems()
            .then(setItems)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user, navigate]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 600);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleBuy = async (itemId: number) => {
        try {
            const res = await buyItem(itemId);
            setCharacter(prev => prev ? { ...prev, money: res.moneyAfter } : prev);
            setMessage(`Куплено! Баланс: ${formatMoney(res.moneyAfter)}`);
        } catch (e: any) {
            setMessage(e.message);
        }
    };

    const filteredItems = items
        .filter((item: any) => {
            if (filterSlot === 'all') return true;
            if (filterSlot === 'ring') return item.slot === 'ring1' || item.slot === 'ring2';
            return item.slot === filterSlot;
        })
        .sort((a: any, b: any) => {
            const priceA = 100 * Math.pow(10, a.rarity);
            const priceB = 100 * Math.pow(10, b.rarity);
            return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
        });

    if (!user || !character) return null;

    // Адаптивные стили для карточки
    const cardWidth = isMobile ? 'calc((100% - 1rem) / 2)' : '200px';
    const cardPadding = isMobile ? '0.5rem' : '1rem';
    const cardFontSize = isMobile ? '0.75rem' : '0.85rem';
    const buttonFontSize = isMobile ? '0.7rem' : '0.8rem';
    const imageSize = isMobile ? '48px' : '64px';


    return (
        <div style={{ padding: '1rem', color: '#eee' }}>
            <button onClick={() => navigate('/')} style={{ background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem' }}>← Назад</button>
            <h2>🛒 Магазин</h2>

            {message && <div style={{ margin: '0.5rem 0', color: '#2ecc71' }}>{message}</div>}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)}
                    style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '0.3rem' }}>
                    {filterSlots.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
                <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    style={{ background: '#3498db', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>
                    Цена {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            {loading ? <div>Загрузка...</div> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {filteredItems.map((item: any) => {
                        const price = 100 * Math.pow(10, item.rarity);
                        const canAfford = character.money >= price;
                        const color = getRarityColor(item.rarity);

                        return (
                            <div key={item.id} style={{
                                border: `2px solid ${color}`,
                                borderRadius: '12px',
                                padding: cardPadding,
                                background: '#2a2a3e',
                                width: cardWidth,
                                boxSizing: 'border-box',   // ← чтобы padding и border не раздвигали
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                color: '#eee',
                                fontSize: cardFontSize,
                            }}>
                                <div
                                    style={{
                                        width: imageSize,
                                        height: imageSize,
                                        border: `2px solid ${color}`,
                                        borderRadius: '8px',
                                        marginBottom: '0.5rem',
                                        background: item.image
                                            ? `url(/${item.image}) center / contain no-repeat`
                                            : color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        color: '#fff',
                                        textShadow: '0 0 2px #000',
                                    }}
                                    onMouseEnter={(e) => setTooltipData({ item, x: e.clientX, y: e.clientY })}
                                    onMouseMove={(e) => setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                                    onMouseLeave={() => setTooltipData(null)}
                                >
                                    {!item.image && item.name.substring(0, 2)}
                                </div>

                                <div style={{ fontWeight: 'bold', color, marginBottom: '0.3rem' }}>{item.name}</div>
                                <div style={{ fontSize: cardFontSize, marginBottom: '0.3rem' }}>Слот: {item.slot}</div>
                                <div style={{ fontSize: cardFontSize, marginBottom: '0.3rem' }}>Редкость: {rarityNames[item.rarity]}</div>

                                {item.bonuses && (
                                    <div style={{ fontSize: cardFontSize, marginBottom: '0.3rem' }}>
                                        {item.bonuses.s ? <div>Сила +{item.bonuses.s}</div> : null}
                                        {item.bonuses.a ? <div>Ловк +{item.bonuses.a}</div> : null}
                                        {item.bonuses.d ? <div>Защ +{item.bonuses.d}</div> : null}
                                        {item.bonuses.m ? <div>Маст +{item.bonuses.m}</div> : null}
                                    </div>
                                )}

                                <div style={{ fontWeight: 'bold', color: '#f1c40f', fontSize: cardFontSize, marginBottom: '0.5rem' }}>
                                    {formatMoney(price)}
                                </div>

                                <button
                                    onClick={() => handleBuy(item.id)}
                                    disabled={!canAfford}
                                    style={{
                                        padding: '0.4rem 1rem',
                                        background: canAfford ? '#2ecc71' : '#555',
                                        color: canAfford ? '#fff' : '#888',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: canAfford ? 'pointer' : 'not-allowed',
                                        fontWeight: 'bold',
                                        width: '100%',
                                        fontSize: buttonFontSize,
                                    }}
                                >
                                    Купить
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {tooltipData && <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />}
        </div>
    );
}