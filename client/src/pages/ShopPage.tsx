import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchShopItems, buyItem } from '../api';
import { formatMoney } from '../utils/money';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from '../components/ItemStats';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import FilterBar from '../components/ui/FilterBar';

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

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchShopItems().then(setItems).catch(console.error).finally(() => setLoading(false));
    }, [user, navigate]);

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
            const priceA = 100 * Math.pow(10, a.rarity_id);
            const priceB = 100 * Math.pow(10, b.rarity_id);
            return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
        });

    if (!user || !character) return null;

    return (
        <div className="px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4">🛒 Магазин</h2>

            {message && <p className="mb-3 text-[var(--color-accent-success)] text-sm">{message}</p>}

            <FilterBar>
                <select
                    value={filterSlot}
                    onChange={e => setFilterSlot(e.target.value)}
                    className="bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] rounded px-2 py-1 text-sm"
                >
                    {filterSlots.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
                <Button size="sm" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                    Цена {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
            </FilterBar>

            {loading ? (
                <p className="text-[var(--color-text-muted)]">Загрузка...</p>
            ) : (
                <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                    {filteredItems.map((item: any) => {
                        const price = 100 * Math.pow(10, item.rarity_id);
                        const canAfford = character.money >= price;
                        const color = getRarityColor(item);

                        return (
                            <div
                                key={item.id}
                                className="rounded-xl p-2 sm:p-3 flex flex-col"
                                style={{
                                    border: `2px solid ${color}`,
                                    background: '#2a2a3e',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
                                }}
                            >
                                <div className="flex-1">
                                    <ItemStats item={item} imageSize={36} />
                                </div>

                                <div className="mt-2">
                                    <div className="text-center text-[0.65rem] sm:text-xs text-[var(--color-text-secondary)] mb-1">
                                        Цена: {formatMoney(price)}
                                    </div>
                                    <Button
                                        variant={canAfford ? 'success' : 'secondary'}
                                        size="xs"
                                        fullWidth
                                        onClick={() => handleBuy(item.id)}
                                        disabled={!canAfford}
                                    >
                                        Купить
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

        </div>
    );
}
