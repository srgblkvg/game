import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAcquire } from '../contexts/AcquireContext';
import { fetchCharacter } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ItemTooltip from '../components/ItemTooltip';
import { inputClass } from '../utils/formStyles';
import { formatMoney } from '../utils/money';
import { getItemImage } from '../utils/itemUtils';

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
    const { showAcquire } = useAcquire();

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

    // Tooltip
    const [tooltip, setTooltip] = useState<{ item: any; x: number; y: number } | null>(null);

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
        return PRICE_FLOOR[rarity] || 5;
    };

    const handleSelectItem = (itemId: string) => {
        setSellItemId(itemId);
        const item = findItemById(character?.inventory, itemId);
        if (item) {
            const isMaterial = item.type === 'craft_item' || item.type === 'material';
            const maxCount = isMaterial ? (item.count || 1) : 1;
            void maxCount;
            setSellCount(1);
            const rarity = item.rarity_id ?? 0;
            const floor = PRICE_FLOOR[rarity] || 5;
            setStartPrice(String(floor));
            setBuyoutPrice('');
        }
    };

    const handleCountChange = (count: number) => {
        setSellCount(count);
    };

    const handleSell = async () => {
        const item = findItemById(character?.inventory, sellItemId);
        if (!item) { setError('Выберите предмет'); return; }
        const isMaterial = item.type === 'craft_item' || item.type === 'material';
        const count = isMaterial ? sellCount : 1;
        const priceNum = parseInt(startPrice);
        if (isNaN(priceNum) || priceNum <= 0) { setError('Укажите корректную стартовую цену'); return; }
        const buyoutNum = buyoutPrice ? parseInt(buyoutPrice) : 0;
        if (buyoutNum > 0 && buyoutNum <= priceNum) { setError('Цена выкупа должна быть выше стартовой'); return; }
        try {
            await api('/auction/sell', {
                itemData: item,
                startPrice: priceNum,
                buyoutPrice: buyoutPrice ? parseInt(buyoutPrice) : null,
                duration,
                count,
            });
            showAcquire(item, count, 'Выставлено на аукцион');
            const fresh = await fetchCharacter();
            setCharacter(fresh);
            setMessage('');
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
        try {
            await api('/auction/buyout', { lotId });
            const lot = lots.find(l => l.id === lotId);
            if (lot) showAcquire(lot.itemData, lot.itemData.count || 1, 'Выкуплено');
            setMessage('');
            load(); const fresh = await fetchCharacter(); setCharacter(fresh);
        }
        catch (e: any) { setError(e.message); }
    };

    const handleBuyPartial = async (lotId: number, quantity: number) => {
        try {
            await api('/auction/buy-partial', { lotId, quantity });
            const lot = lots.find(l => l.id === lotId);
            if (lot) showAcquire(lot.itemData, quantity, 'Куплено');
            setMessage('');
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

    const showTooltip = (e: React.MouseEvent, item: any) => setTooltip({ item, x: e.clientX, y: e.clientY });
    const moveTooltip = (e: React.MouseEvent) => { if (tooltip) setTooltip({ ...tooltip, x: e.clientX, y: e.clientY }); };
    const hideTooltip = () => setTooltip(null);

    // Long press for mobile tooltips
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const isTouching = useRef(false);

    // Hide tooltip on click outside
    useEffect(() => {
        if (!tooltip) return;
        const handler = (e: MouseEvent | TouchEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
                setTooltip(null);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [tooltip]);

    const showTooltip = (e: React.MouseEvent, item: any) => {
        if (isTouching.current) return;
        setTooltip({ item, x: e.clientX, y: e.clientY });
    };
    const moveTooltip = (e: React.MouseEvent) => {
        if (isTouching.current) return;
        if (tooltip) setTooltip({ ...tooltip, x: e.clientX, y: e.clientY });
    };
    const hideTooltip = () => {
        if (isTouching.current) return;
        setTooltip(null);
    };

    const handleTouchStart = useCallback((e: React.TouchEvent, item: any) => {
        isTouching.current = true;
        longPressTimer.current = setTimeout(() => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (touch) setTooltip({ item, x: touch.clientX, y: touch.clientY });
        }, 500);
    }, []);
    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        setTimeout(() => { isTouching.current = false; }, 300);
    }, []);

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-1"><Icon icon="game-icons:auction" width="22" height="22" className="inline mr-2" />Аукцион</h1>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">Торговая площадка Мёртвых земель — покупайте и продавайте предметы между игроками</p>

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
                        Занято слотов: {userLotCount} из {maxSlots}
                        {userLotCount >= maxSlots && ' (максимум)'}
                    </p>

                    {/* Item selection grid */}
                    <div className="mb-3">
                        <label className="text-xs text-[var(--color-text-muted)] block mb-2">Выберите предмет для продажи:</label>
                        {(!character?.inventory || character.inventory.length === 0) ? (
                            <p className="text-xs text-[var(--color-text-muted)]">Нет предметов для продажи</p>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {character.inventory.map((item: any) => {
                                    const isSelected = String(item.id) === sellItemId;
                                    const cnt = (item.type === 'craft_item' || item.type === 'material') ? (item.count || 1) : 1;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectItem(String(item.id))}
                                            onMouseEnter={e => showTooltip(e, item)}
                                            onMouseMove={moveTooltip}
                                            onMouseLeave={hideTooltip}
                                            onTouchStart={e => handleTouchStart(e, item)}
                                            onTouchEnd={handleTouchEnd}
                                            onContextMenu={e => e.preventDefault()}
                                            className={`relative flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/10 ring-1 ring-[var(--color-accent-info)]'
                                                    : 'border-[var(--color-border-default)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-hover)]'
                                            }`}
                                        >
                                            <img
                                                src={getItemImage(item) || '/items/default.webp'}
                                                alt={item.name}
                                                className="w-8 h-8 object-contain mb-1"
                                                onError={e => { (e.target as HTMLImageElement).src = '/items/default.webp'; }}
                                            />
                                            <span className="text-[0.6rem] text-[var(--color-text-primary)] text-center leading-tight line-clamp-2">
                                                {item.name}
                                            </span>
                                            {cnt > 1 && (
                                                <span className="text-[0.55rem] text-[var(--color-accent-info)] absolute top-0.5 right-1">
                                                    x{cnt}
                                                </span>
                                            )}
                                            <span className="text-[0.55rem] text-[var(--color-text-muted)]">
                                                {item.rarity_display || ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected item preview */}
                    {selectedItem && (
                        <div
                            className="mt-2 flex items-center gap-2 p-2 rounded bg-[var(--color-bg-primary)] cursor-default"
                            onMouseEnter={e => showTooltip(e, selectedItem)}
                            onMouseMove={moveTooltip}
                            onMouseLeave={hideTooltip}
                            onTouchStart={e => handleTouchStart(e, selectedItem)}
                            onTouchEnd={handleTouchEnd}
                            onContextMenu={e => e.preventDefault()}
                        >
                            <img
                                src={getItemImage(selectedItem) || '/items/default.webp'}
                                alt={selectedItem.name}
                                className="w-8 h-8 object-contain rounded"
                                onError={e => { (e.target as HTMLImageElement).src = '/items/default.webp'; }}
                            />
                            <span className="text-xs text-[var(--color-text-primary)]">{selectedItem.name}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{selectedItem.rarity_display}</span>
                        </div>
                    )}

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
                            Стартовая цена за 1 шт (мин: {formatMoney(autoMin)})
                        </label>
                        <input type="number" placeholder="Цена за 1 шт" value={startPrice}
                            onChange={e => setStartPrice(e.target.value)} className={inputClass} min={autoMin} />
                        {isMaterial && sellCount > 1 && (
                            <p className="text-xs text-[var(--color-accent-info)] mt-1">
                                Итого за {sellCount} шт: {formatMoney(parseInt(startPrice || '0') * sellCount)}
                            </p>
                        )}
                    </div>
                    <div className="mb-2">
                        <label className="text-xs text-[var(--color-text-muted)] block mb-1">
                            Цена выкупа за 1 шт (необязательно)
                        </label>
                        <input type="number" placeholder="Выкуп за 1 шт" value={buyoutPrice}
                            onChange={e => setBuyoutPrice(e.target.value)} className={inputClass} />
                        {isMaterial && sellCount > 1 && buyoutPrice && (
                            <p className="text-xs text-[var(--color-accent-info)] mt-1">
                                Итого выкуп за {sellCount} шт: {formatMoney(parseInt(buyoutPrice) * sellCount)}
                            </p>
                        )}
                    </div>
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
                // Цена за штуку для частичного выкупа — от выкупа (если есть)
                const buyoutPerItem = lot.buyoutPrice ? Math.ceil(lot.buyoutPrice / stackCount) : pricePerItem;
                const minBid = lot.currentBid ? Math.floor(lot.currentBid * 1.05) : lot.startPrice;
                const hoursLeft = Math.max(0, Math.ceil((lot.endsAt - Date.now() / 1000) / 3600));

                return (
                    <Card key={lot.id} className="mb-3">
                        <div className="flex justify-between items-start">
                            <div
                                onMouseEnter={e => showTooltip(e, item)}
                                onMouseMove={moveTooltip}
                                onMouseLeave={hideTooltip}
                                onTouchStart={e => handleTouchStart(e, item)}
                                onTouchEnd={handleTouchEnd}
                                onContextMenu={e => e.preventDefault()}
                                className="cursor-default flex gap-3"
                            >
                                <img
                                    src={getItemImage(item) || '/items/default.webp'}
                                    alt={item.name}
                                    className="w-10 h-10 object-contain rounded shrink-0"
                                    onError={e => { (e.target as HTMLImageElement).src = '/items/default.webp'; }}
                                />
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
                                    {isStack && <span className="text-[var(--color-accent-info)]"> ({formatMoney(pricePerItem)} / шт)</span>}
                                    {lot.currentBid && <> • Ставка: {formatMoney(lot.currentBid)}</>}
                                </p>
                                {lot.buyoutPrice && (
                                    <p className="text-xs">
                                        Выкуп: {formatMoney(lot.buyoutPrice)}
                                        {isStack && <span className="text-[var(--color-accent-info)]"> ({formatMoney(Math.ceil(lot.buyoutPrice / stackCount))} / шт)</span>}
                                    </p>
                                )}
                                {isStack && (
                                    <p className="text-xs text-[var(--color-accent-info)]">
                                        ≈ {formatMoney(pricePerItem)} / шт
                                    </p>
                                )}
                            </div>
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
                                    Купить {partialQty[lot.id] ?? 1} шт ({formatMoney(buyoutPerItem * (partialQty[lot.id] ?? 1))})
                                </Button>
                            </div>
                        )}
                    </Card>
                );
            })}

            {tooltip && <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} />}
        </div>
    );
}
