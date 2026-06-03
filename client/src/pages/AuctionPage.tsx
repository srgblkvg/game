import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import { formatMoney } from '../utils/money';

// Мин. цены по редкости (копия серверного priceFloor)
const PRICE_FLOOR: Record<number, number> = { 0: 5, 1: 15, 2: 50, 3: 150, 4: 400, 5: 1000, 6: 3000 };

// Helper: find item by ID, handling string/number type mismatch
const findItemById = (inventory: any[] | undefined, id: string): any => {
    if (!inventory) return undefined;
    return inventory.find((i: any) => String(i.id) === id);
};

export default function AuctionPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();

    const [lots, setLots] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'buy' | 'sell'>('buy');

    // Sell form
    const [sellItemId, setSellItemId] = useState('');
    const [sellCount, setSellCount] = useState(1);
    const [startPrice, setStartPrice] = useState('');
    const [buyoutPrice, setBuyoutPrice] = useState('');
    const [duration, setDuration] = useState(24);

    // Bid
    const [bidAmount, setBidAmount] = useState<Record<number, string>>({});
    // Partial buy quantity
    const [partialQty, setPartialQty] = useState<Record<number, number>>({});

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

    const load = async () => {
        try { const res = await fetch(`${BASE_URL}/auction`, { headers: getHeaders() }); setLots(await res.json()); }
        catch (e: any) { setError(e.message); }
    };

    const api = async (url: string, body?: any) => {
        const res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    };

    // Count user's active lots for slot display
    const userLotCount = lots.filter((l: any) => l.sellerId === character?.id).length;
    const maxSlots = 5;

    // Auto-calc min price when item or count changes
    const getSelectedItem = () => findItemById(character?.inventory, sellItemId);

    const getAutoMinPrice = () => {
        const item = getSelectedItem();
        if (!item) return 0;
        const rarity = item.rarity_id ?? 0;
        const floor = PRICE_FLOOR[rarity] || 5;
        const isMaterial = item.type === 'craft_item' || item.type === 'material';
        const count = isMaterial ? sellCount : 1;
        return floor * count;
    };

    const handleSelectItem = (itemId: string) => {
        setSellItemId(itemId);
        const item = findItemById(character?.inventory, itemId);
        if (item) {
            const isMaterial = item.type === 'craft_item' || item.type === 'material';
            const maxCount = isMaterial ? (item.count || 1) : 1;
            setSellCount(1);
            const rarity = item.rarity_id ?? 0;
            const floor = PRICE_FLOOR[rarity] || 5;
            setStartPrice(String(floor));
            setBuyoutPrice('');
        }
    };

    const handleCountChange = (count: number) => {
        setSellCount(count);
        // Recalculate min price
        const item = getSelectedItem();
        if (item) {
            const rarity = item.rarity_id ?? 0;
            const floor = PRICE_FLOOR[rarity] || 5;
            setStartPrice(String(floor * count));
        }
    };

    const handleSell = async () => {
        const item = findItemById(character?.inventory, sellItemId);
        if (!item) { setError('Выберите предмет'); return; }
        const isMaterial = item.type === 'craft_item' || item.type === 'material';
        const count = isMaterial ? sellCount : 1;
        const priceNum = parseInt(startPrice);
        if (isNaN(priceNum) || priceNum <= 0) { setError('Укажите корректную стартовую цену'); return; }
        try {
            await api('/auction/sell', {
                itemData: item,
                startPrice: priceNum,
                buyoutPrice: buyoutPrice ? parseInt(buyoutPrice) : null,
                duration,
                count,
            });
            const fresh = await fetchCharacter();
            setCharacter(fresh);
            setMessage('Лот выставлен!');
            setSellItemId('');
            setStartPrice('');
            setBuyoutPrice('');
            setSellCount(1);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleBid = async (lotId: number, amount: string) => {
        try { await api('/auction/bid', { lotId, amount: parseInt(amount) }); setMessage('Ставка сделана!'); load(); const fresh = await fetchCharacter(); setCharacter(fresh); }
        catch (e: any) { setError(e.message); }
    };

    const handleBuyout = async (lotId: number) => {
        try { await api('/auction/buyout', { lotId }); setMessage('Куплено!'); load(); const fresh = await fetchCharacter(); setCharacter(fresh); }
        catch (e: any) { setError(e.message); }
    };

    const handleBuyPartial = async (lotId: number, quantity: number) => {
        try {
            const result = await api('/auction/buy-partial', { lotId, quantity });
            setMessage(`Куплено ${quantity} шт. за ${formatMoney(result.cost)} 🥇`);
            load();
            const fresh = await fetchCharacter();
            setCharacter(fresh);
        } catch (e: any) { setError(e.message); }
    };

    const clearMessages = () => { setMessage(''); setError(''); };

    const selectedItem = getSelectedItem();
    const autoMin = getAutoMinPrice();
    const isMaterial = selectedItem?.type === 'craft_item' || selectedItem?.type === 'material';
    const maxItemCount = isMaterial ? (selectedItem?.count || 1) : 1;

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:auction" width="22" height="22" className="inline mr-2" />Некропольный Торг</h1>

            <div className="flex gap-2 mb-4">
                <Button variant={tab === 'buy' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('buy'); clearMessages(); }}>Покупка</Button>
                <Button variant={tab === 'sell' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('sell'); clearMessages(); }}>Продажа</Button>
            </div>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            {tab === 'sell' && (
                <Card className="mb-4">
                    <h3 className="font-bold mb-2">Выставить лот</h3>

                    {/* Slot availability */}
                    <p className={`text-xs mb-2 ${userLotCount >= maxSlots ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                        Доступно слотов: {userLotCount} из {maxSlots}
                        {userLotCount >= maxSlots && ' (максимум достигнут)'}
                    </p>

                    <select value={sellItemId} onChange={e => handleSelectItem(e.target.value)} className={inputClass}>
                        <option value="">— Выберите предмет —</option>
                        {character?.inventory
                            .map((item: any) => {
                                const cnt = (item.type === 'craft_item' || item.type === 'material') ? (item.count || 1) : 1;
                                const label = cnt > 1 ? `${item.name} x${cnt} (${item.rarity_display || '?'})` : `${item.name} (${item.rarity_display || '?'})`;
                                return <option key={item.id} value={item.id}>{label}</option>;
                            })
                        }
                    </select>

                    {/* Count selector for stackable items */}
                    {isMaterial && maxItemCount > 1 && (
                        <div className="mb-2">
                            <label className="text-xs text-[var(--color-text-muted)] block mb-1">
                                Количество для продажи (макс: {maxItemCount})
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="range"
                                    min={1}
                                    max={maxItemCount}
                                    value={sellCount}
                                    onChange={e => handleCountChange(parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    max={maxItemCount}
                                    value={sellCount}
                                    onChange={e => {
                                        const v = parseInt(e.target.value);
                                        if (!isNaN(v)) handleCountChange(Math.max(1, Math.min(maxItemCount, v)));
                                    }}
                                    className={inputClass + ' w-16 text-center'}
                                />
                                <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                                    onClick={() => handleCountChange(maxItemCount)}
                                >Все</button>
                            </div>
                        </div>
                    )}

                    <div className="mb-2">
                        <label className="text-xs text-[var(--color-text-muted)] block mb-1">
                            Стартовая цена (мин: {formatMoney(autoMin)} 🥇)
                        </label>
                        <input type="number" placeholder="Стартовая цена" value={startPrice}
                            onChange={e => setStartPrice(e.target.value)} className={inputClass} min={autoMin} />
                    </div>
                    <input type="number" placeholder="Выкуп (необязательно)" value={buyoutPrice}
                        onChange={e => setBuyoutPrice(e.target.value)} className={inputClass} />
                    <select value={duration} onChange={e => setDuration(+e.target.value)} className={inputClass}>
                        <option value={6}>6 часов</option>
                        <option value={12}>12 часов</option>
                        <option value={24}>24 часа</option>
                        <option value={48}>48 часов</option>
                    </select>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">Комиссия 5% от стартовой цены</p>
                    <Button variant="danger" size="sm" onClick={handleSell}>Выставить (5% комиссия)</Button>
                </Card>
            )}

            {tab === 'buy' && lots.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">Нет активных лотов</p>
            )}

            {tab === 'buy' && lots.map((lot: any) => {
                const item = lot.itemData;
                const stackCount = item.count || 1;
                const isStack = stackCount > 1;
                const totalPrice = lot.currentBid ?? lot.startPrice;
                const pricePerItem = Math.ceil(totalPrice / stackCount);
                const minBid = lot.currentBid ? Math.floor(lot.currentBid * 1.05) : lot.startPrice;
                const hoursLeft = Math.max(0, Math.ceil((lot.endsAt - Date.now() / 1000) / 3600));

                return (
                    <Card key={lot.id} className="mb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-sm">
                                    {item.name}
                                    {isStack && <span className="text-xs text-[var(--color-accent-info)] ml-1">x{stackCount}</span>}
                                </h3>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {item.rarity_display} • {lot.sellerName}
                                </p>
                                <p className="text-xs">
                                    Старт: {formatMoney(lot.startPrice)}
                                    {lot.currentBid && <> • Ставка: {formatMoney(lot.currentBid)}</>}
                                </p>
                                {lot.buyoutPrice && <p className="text-xs">Выкуп: {formatMoney(lot.buyoutPrice)}</p>}
                                {isStack && (
                                    <p className="text-xs text-[var(--color-accent-info)]">
                                        ≈ {formatMoney(pricePerItem)} 🥇 / шт
                                    </p>
                                )}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">{hoursLeft}ч</div>
                        </div>

                        {/* Bid section */}
                        <div className="flex gap-2 mt-2 items-center">
                            <input type="number" placeholder={`Мин: ${formatMoney(minBid)}`}
                                value={bidAmount[lot.id] || ''}
                                onChange={e => setBidAmount({ ...bidAmount, [lot.id]: e.target.value })}
                                className={inputClass + ' w-24'} min={minBid} />
                            <Button variant="primary" size="xs" onClick={() => handleBid(lot.id, bidAmount[lot.id] || '0')}>Ставка</Button>
                            {lot.buyoutPrice && (
                                <Button variant="danger" size="xs" onClick={() => handleBuyout(lot.id)}>Выкуп</Button>
                            )}
                        </div>

                        {/* Partial buy for stacks */}
                        {isStack && (
                            <div className="flex gap-2 mt-2 items-center border-t border-[var(--color-border)] pt-2">
                                <input
                                    type="number"
                                    placeholder="Кол-во"
                                    min={1}
                                    max={stackCount}
                                    value={partialQty[lot.id] ?? 1}
                                    onChange={e => setPartialQty({ ...partialQty, [lot.id]: Math.max(1, Math.min(stackCount, parseInt(e.target.value) || 1)) })}
                                    className={inputClass + ' w-20'}
                                />
                                <Button variant="secondary" size="xs"
                                    onClick={() => handleBuyPartial(lot.id, partialQty[lot.id] ?? 1)}>
                                    Купить {partialQty[lot.id] ?? 1} шт ({formatMoney(pricePerItem * (partialQty[lot.id] ?? 1))} 🥇)
                                </Button>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
