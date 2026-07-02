import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
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
import { fmtSafeDate } from '../utils/date';
import { getItemImage } from '../utils/itemUtils';

const PRICE_FLOOR: Record<number, number> = { 0: 5, 1: 15, 2: 50, 3: 150, 4: 400, 5: 1000, 6: 3000 };

const findItemById = (inventory: any[] | undefined, id: string): any => {
    if (!inventory) return undefined;
    return inventory.find((i: any) => String(i.id) === id);
};

const CATEGORIES = [
    { key: 'all', label: 'Все', icon: 'game-icons:swap-bag' },
    { key: 'weapon', label: 'Оружие', icon: 'game-icons:crossed-swords' },
    { key: 'shield', label: 'Щит', icon: 'game-icons:shield' },
    { key: 'chest', label: 'Нагрудник', icon: 'game-icons:chest-armor' },
    { key: 'helmet', label: 'Шлем', icon: 'game-icons:elf-helmet' },
    { key: 'gloves', label: 'Перчатки', icon: 'game-icons:leather-vest' },
    { key: 'boots', label: 'Сапоги', icon: 'game-icons:boots' },
    { key: 'ring', label: 'Кольца', icon: 'game-icons:ring' },
    { key: 'amulet', label: 'Амулет', icon: 'game-icons:pentacle' },
    { key: 'belt', label: 'Пояс', icon: 'game-icons:belt' },
    { key: 'material', label: 'Материалы', icon: 'game-icons:powder' },
    { key: 'upgrade', label: 'Улучшения', icon: 'game-icons:upgrade' },
];

const SORT_OPTIONS = [
    { key: 'quality_desc', label: 'Качество ↓' },
    { key: 'quality_asc', label: 'Качество ↑' },
    { key: 'price_asc', label: 'Цена/шт ↑' },
    { key: 'price_desc', label: 'Цена/шт ↓' },
    { key: 'buyout_asc', label: 'Выкуп/шт ↑' },
    { key: 'buyout_desc', label: 'Выкуп/шт ↓' },
];

// Парсер поискового запроса: "крит перчатки" → { stats: {minCrit:1}, category: "gloves" }
// "сила ловкость защита" → три стата одновременно
const STAT_KEYWORDS: Record<string, string> = {
    'сила': 'minStr', 'силы': 'minStr',
    'ловкость': 'minAgi', 'ловкости': 'minAgi',
    'защита': 'minDef', 'защиты': 'minDef',
    'крит': 'minCrit', 'крита': 'minCrit',
    'уклон': 'minDodge', 'уклонения': 'minDodge',
    'контратака': 'minCounter', 'контратаки': 'minCounter',
    'блок': 'minBlock', 'блока': 'minBlock',
    'мастерство': 'minMag', 'мастерства': 'minMag',
};

// Ключевые слова для типа предмета (слота)
const SLOT_KEYWORDS: Record<string, string> = {
    'оружие': 'weapon', 'меч': 'weapon', 'топор': 'weapon', 'копьё': 'weapon', 'копье': 'weapon', 'лук': 'weapon', 'посох': 'weapon',
    'щит': 'shield',
    'нагрудник': 'chest', 'броня': 'chest', 'кираса': 'chest', 'доспех': 'chest',
    'шлем': 'helmet', 'капюшон': 'helmet',
    'перчатки': 'gloves', 'рукавицы': 'gloves',
    'сапоги': 'boots', 'ботинки': 'boots',
    'кольцо': 'ring', 'кольца': 'ring',
    'амулет': 'amulet',
    'пояс': 'belt', 'ремень': 'belt',
    'материал': 'material', 'материалы': 'material', 'ресурс': 'material',
    'улучшение': 'upgrade', 'камень': 'upgrade', 'камни': 'upgrade',
};

function parseSearch(query: string): { text: string; stats: Record<string, number>; category: string } {
    const stats: Record<string, number> = {};
    let category = 'all';
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const textParts: string[] = [];
    
    const matchPrefix = (token: string, dict: Record<string, string>): string | undefined => {
        // exact match
        if (dict[token]) return dict[token];
        // prefix match
        for (const [key, val] of Object.entries(dict)) {
            if (key.startsWith(token)) return val;
        }
        return undefined;
    };
    
    for (const token of tokens) {
        const statField = matchPrefix(token, STAT_KEYWORDS);
        const slotField = matchPrefix(token, SLOT_KEYWORDS);
        if (statField) {
            stats[statField] = 1;
        } else if (slotField) {
            category = slotField;
        } else {
            textParts.push(token);
        }
    }
    
    return { text: textParts.join(' '), stats, category };
}



export default function AuctionPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { showAcquire } = useAcquire();

    const [lots, setLots] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'buy' | 'sell' | 'history'>('buy');
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Highlight specific lot from chat link
    const highlightLotId = searchParams.get('lot');

    useEffect(() => {
        if (highlightLotId) {
            setTab('buy');
        }
    }, [highlightLotId]);

    // Scroll to highlighted lot after lots are loaded
    useEffect(() => {
        if (!highlightLotId || lots.length === 0) return;
        const el = document.getElementById(`auction-lot-${highlightLotId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const t = setTimeout(() => {
                const p = new URLSearchParams(searchParams);
                p.delete('lot');
                setSearchParams(p, { replace: true });
            }, 2000);
            return () => clearTimeout(t);
        }
    }, [lots, highlightLotId]);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    // Sell form
    const [sellItemId, setSellItemId] = useState('');
    const [sellCount, setSellCount] = useState(1);
    const [startPrice, setStartPrice] = useState('');
    const [buyoutPrice, setBuyoutPrice] = useState('');
    const [duration, setDuration] = useState(24);

    // Bid
    const [bidAmount, setBidAmount] = useState<Record<number, string>>({});
    const [partialQty, setPartialQty] = useState<Record<number, number>>({});

    // Tooltip
    const [tooltip, setTooltip] = useState<{ item: any; x: number; y: number } | null>(null);

    // Filters
    const [auctionSearch, setAuctionSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [sort, setSort] = useState('quality_desc');

    useEffect(() => { if (!user) navigate('/login'); else load(1); }, [user]);

    useEffect(() => {
        localStorage.setItem('auctionBadge', '0');
        window.dispatchEvent(new CustomEvent('auctionBadge'));
        fetch(`${BASE_URL}/auction/reset-badge`, { method: 'POST', headers: getHeaders() }).catch(() => {});
    }, []);

    // Динамическая фильтрация при вводе (с debounce 300ms)
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const initialRender = useRef(true);
    useEffect(() => {
        if (initialRender.current) { initialRender.current = false; return; }
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => load(1), 300);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [auctionSearch, category, sort]);

    useEffect(() => {
        const handler = () => load(page);
        window.addEventListener('auctionChanged', handler);
        return () => window.removeEventListener('auctionChanged', handler);
    }, [page, auctionSearch, category, sort]);

    const load = async (pg?: number) => {
        setLoading(true);
        try {
            const p = pg || page;
            const { text, stats, category: parsedCategory } = parseSearch(auctionSearch);
            const qs = new URLSearchParams();
            qs.set('page', String(p));
            qs.set('limit', String(limit));
            if (text) qs.set('search', text);
            const activeCategory = parsedCategory !== 'all' ? parsedCategory : category;
            if (activeCategory !== 'all') qs.set('category', activeCategory);
            qs.set('sort', sort);
            for (const [k, v] of Object.entries(stats)) {
                if (v > 0) qs.set(k, String(v));
            }
            const res = await fetch(`${BASE_URL}/auction?${qs}`, { headers: getHeaders() });
            const data = await res.json();
            setLots(Array.isArray(data.lots) ? data.lots : []);
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 1);
            setPage(data.page || 1);
            setUserLotCount(data.myLotCount || 0);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const loadHistory = async () => {
        try { const res = await fetch(`${BASE_URL}/auction/history?limit=50`, { headers: getHeaders() }); const data = await res.json(); setHistory(Array.isArray(data) ? data : []); }
        catch {}
    };

    const api = async (url: string, body?: any) => {
        const res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    };

    const [userLotCount, setUserLotCount] = useState(0);
    const maxSlots = 5;
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
            void (isMaterial ? (item.count || 1) : 1);
            setSellCount(1);
            const rarity = item.rarity_id ?? 0;
            const floor = PRICE_FLOOR[rarity] || 5;
            setStartPrice(String(floor));
            setBuyoutPrice('');
        }
    };
    const handleCountChange = (count: number) => { setSellCount(count); };
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
            await api('/auction/sell', { itemData: item, startPrice: priceNum, buyoutPrice: buyoutNum || null, duration, count });
            showAcquire(item, count, 'Выставлено на аукцион');
            const fresh = await fetchCharacter(); setCharacter(fresh);
            setMessage(''); setSellItemId(''); setStartPrice(''); setBuyoutPrice(''); setSellCount(1);
            load(1);
        } catch (e: any) { setError(e.message); }
    };
    const handleBid = async (lotId: number, amount: string, minBid: number) => {
        const amt = parseInt(amount);
        if (!amt || amt < minBid) { setError(`Мин. ставка: ${formatMoney(minBid)}`); return; }
        try { await api('/auction/bid', { lotId, amount: amt }); setMessage('Ставка сделана!'); setBidAmount(prev => { const n = { ...prev }; delete n[lotId]; return n; }); load(page); const fresh = await fetchCharacter(); setCharacter(fresh); }
        catch (e: any) { setError(e.message); }
    };
    const handleBuyout = async (lotId: number) => {
        try {
            await api('/auction/buyout', { lotId });
            const lot = lots.find(l => l.id === lotId);
            if (lot) showAcquire(lot.itemData, lot.itemData.count || 1, 'Выкуплено');
            setMessage(''); load(page); const fresh = await fetchCharacter(); setCharacter(fresh);
        } catch (e: any) { setError(e.message); }
    };
    const handleBuyPartial = async (lotId: number, quantity: number) => {
        try {
            await api('/auction/buy-partial', { lotId, quantity });
            const lot = lots.find(l => l.id === lotId);
            if (lot) showAcquire(lot.itemData, quantity, 'Куплено');
            setMessage(''); load(page); const fresh = await fetchCharacter(); setCharacter(fresh);
        } catch (e: any) { setError(e.message); }
    };
    const handleCancel = async (lotId: number) => {
        if (!confirm('Снять лот с аукциона? Предмет вернётся в инвентарь.')) return;
        try { await api('/auction/cancel', { lotId }); setMessage('Лот снят с аукциона'); load(page); const fresh = await fetchCharacter(); setCharacter(fresh); }
        catch (e: any) { setError(e.message); }
    };
    const clearMessages = () => { setMessage(''); setError(''); };
    const selectedItem = getSelectedItem();
    const autoMin = getAutoMinPrice();
    const isMaterial = selectedItem?.type === 'craft_item' || selectedItem?.type === 'material';
    const maxItemCount = isMaterial ? (selectedItem?.count || 1) : 1;

    // Pagination render
    const renderPagination = () => {
        if (totalPages <= 1) return null;
        const pages: number[] = [];
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);
        for (let i = start; i <= end; i++) pages.push(i);

        return (
            <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
                <button onClick={() => load(page - 1)} disabled={page <= 1}
                    className="px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 cursor-pointer">
                    ←
                </button>
                {start > 1 && <>
                    <button onClick={() => load(1)} className="px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer">1</button>
                    {start > 2 && <span className="px-1 text-xs text-[var(--color-text-muted)]">…</span>}
                </>}
                {pages.map(p => (
                    <button key={p} onClick={() => load(p)}
                        className={`px-2.5 py-1 text-xs rounded cursor-pointer ${p === page ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}>
                        {p}
                    </button>
                ))}
                {end < totalPages && <>
                    {end < totalPages - 1 && <span className="px-1 text-xs text-[var(--color-text-muted)]">…</span>}
                    <button onClick={() => load(totalPages)} className="px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer">{totalPages}</button>
                </>}
                <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                    className="px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 cursor-pointer">
                    →
                </button>
                <span className="text-xs text-[var(--color-text-muted)] ml-2">{totalCount} лотов</span>
            </div>
        );
    };

    // Tooltip handlers
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const supportsHover = useRef(window.matchMedia('(hover: hover)').matches);
    useEffect(() => {
        if (!tooltip) return;
        const handler = (e: MouseEvent | TouchEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setTooltip(null);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
    }, [tooltip]);
    const showTooltip = (e: React.MouseEvent, item: any) => {
        if (!supportsHover.current) return;
        setTooltip({ item, x: e.clientX, y: e.clientY });
    };
    const moveTooltip = (e: React.MouseEvent) => { if (!supportsHover.current) return; if (tooltip) setTooltip({ ...tooltip, x: e.clientX, y: e.clientY }); };
    const hideTooltip = () => { if (!supportsHover.current) return; setTooltip(null); };
    const handleTouchStart = useCallback((e: React.TouchEvent, item: any) => {
        longPressTimer.current = setTimeout(() => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (touch) setTooltip({ item, x: touch.clientX, y: touch.clientY });
        }, 500);
    }, []);
    const handleTouchEnd = useCallback(() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }, []);

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-1"><Icon icon="game-icons:pay-money" width="22" height="22" className="inline mr-2" />Аукцион</h1>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">Торговая площадка Мёртвых земель — покупайте и продавайте предметы между игроками</p>

            <div className="flex gap-2 mb-4">
                <Button variant={tab === 'buy' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('buy'); clearMessages(); }}>Покупка</Button>
                <Button variant={tab === 'sell' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('sell'); clearMessages(); }}>Продажа</Button>
                <Button variant={tab === 'history' ? 'primary' : 'secondary'} size="xs" onClick={() => { setTab('history'); loadHistory(); clearMessages(); }}>История</Button>
            </div>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {/* Sell tab */}
            {tab === 'sell' && (
                <Card className="mb-4">
                    <h3 className="font-bold mb-2">Выставить лот</h3>
                    <p className={`text-xs mb-2 ${userLotCount >= maxSlots ? 'text-[var(--color-accent-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                        Занято слотов: {userLotCount} из {maxSlots}{userLotCount >= maxSlots && ' (максимум)'}
                    </p>
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
                                        <div key={item.id} onClick={() => handleSelectItem(String(item.id))}
                                            onMouseEnter={e => showTooltip(e, item)} onMouseMove={moveTooltip} onMouseLeave={hideTooltip}
                                            onTouchStart={e => handleTouchStart(e, item)} onTouchEnd={handleTouchEnd} onContextMenu={e => e.preventDefault()}
                                            className={`relative flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/10 ring-1 ring-[var(--color-accent-info)]' : 'border-[var(--color-border-default)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-hover)]'}`}>
                                            <img src={getItemImage(item) || '/items/default.webp'} alt={item.name} className="w-8 h-8 object-contain mb-1" onError={e => { (e.target as HTMLImageElement).src = '/items/default.webp'; }} />
                                            <span className="text-[0.6rem] text-[var(--color-text-primary)] text-center leading-tight line-clamp-2">{item.name}</span>
                                            {cnt > 1 && <span className="text-[0.55rem] text-[var(--color-accent-info)] absolute top-0.5 right-1">x{cnt}</span>}
                                            <span className="text-[0.55rem] text-[var(--color-text-muted)]">{item.rarity_display || ''}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {selectedItem && (
                        <div className="mt-2 flex items-center gap-2 p-2 rounded bg-[var(--color-bg-primary)] cursor-default"
                            onMouseEnter={e => showTooltip(e, selectedItem)} onMouseMove={moveTooltip} onMouseLeave={hideTooltip}
                            onTouchStart={e => handleTouchStart(e, selectedItem)} onTouchEnd={handleTouchEnd} onContextMenu={e => e.preventDefault()}>
                            <img src={getItemImage(selectedItem) || '/items/default.webp'} alt={selectedItem.name} className="w-8 h-8 object-contain rounded" onError={e => { (e.target as HTMLImageElement).src = '/items/default.webp'; }} />
                            <span className="text-xs text-[var(--color-text-primary)]">{selectedItem.name}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{selectedItem.rarity_display}</span>
                        </div>
                    )}
                    {isMaterial && maxItemCount > 1 && (
                        <div className="mb-2">
                            <label className="text-xs text-[var(--color-text-muted)] block mb-1">Количество для продажи (макс: {maxItemCount})</label>
                            <div className="flex gap-2 items-center">
                                <input type="range" min={1} max={maxItemCount} value={sellCount} onChange={e => handleCountChange(parseInt(e.target.value))} className="flex-1" />
                                <input type="number" min={1} max={maxItemCount} value={sellCount} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) handleCountChange(Math.max(1, Math.min(maxItemCount, v))); }} className={inputClass + ' w-16 text-center'} />
                                <button type="button" className="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]" onClick={() => handleCountChange(maxItemCount)}>Все</button>
                            </div>
                        </div>
                    )}
                    <div className="mb-2"><label className="text-xs text-[var(--color-text-muted)] block mb-1">Стартовая цена за 1 шт (мин: {formatMoney(autoMin)})</label><input type="number" placeholder="Цена за 1 шт" value={startPrice} onChange={e => setStartPrice(e.target.value)} className={inputClass} min={autoMin} />{isMaterial && sellCount > 1 && <p className="text-xs text-[var(--color-accent-info)] mt-1">Итого за {sellCount} шт: {formatMoney(parseInt(startPrice || '0') * sellCount)}</p>}</div>
                    <div className="mb-2"><label className="text-xs text-[var(--color-text-muted)] block mb-1">Цена выкупа за 1 шт (необязательно)</label><input type="number" placeholder="Выкуп за 1 шт" value={buyoutPrice} onChange={e => setBuyoutPrice(e.target.value)} className={inputClass} />{isMaterial && sellCount > 1 && buyoutPrice && <p className="text-xs text-[var(--color-accent-info)] mt-1">Итого выкуп за {sellCount} шт: {formatMoney(parseInt(buyoutPrice) * sellCount)}</p>}</div>
                    <select value={duration} onChange={e => setDuration(+e.target.value)} className={inputClass}><option value={6}>6 часов</option><option value={12}>12 часов</option><option value={24}>24 часа</option><option value={48}>48 часов</option></select>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">Комиссия 5% от стартовой цены</p>
                    <Button variant="danger" size="sm" onClick={handleSell}>Выставить (5% комиссия)</Button>
                </Card>
            )}

            {/* History tab */}
            {tab === 'history' && (
                <div>{history.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Нет завершённых сделок</p> : <div className="space-y-2">{history.map((h: any) => { const isBuyer = h.buyerId === user?.id; const itemData = h.itemData ? (typeof h.itemData === 'string' ? JSON.parse(h.itemData) : h.itemData) : null; return <Card key={h.id} className="text-xs"><div className="flex items-center gap-1 flex-wrap"><span className={isBuyer ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}>{isBuyer ? '📥 Куплено' : '📤 Продано'}</span><span className="font-medium">{h.itemName}</span>{itemData?.count > 1 && <span className="text-[var(--color-text-muted)]">x{itemData.count}</span>}<span>за</span><span className="font-bold">{formatMoney(h.price)}</span><span className="text-[var(--color-text-muted)]">—</span><span className="text-[var(--color-text-muted)]">Продавец {h.sellerName}, покупатель {h.buyerName}</span></div><div className="text-[var(--color-text-muted)] mt-0.5">{h.commission > 0 && <>ком. {formatMoney(h.commission)} • </>}{fmtSafeDate(h.createdAt)}</div></Card>; })}</div>}</div>
            )}

            {/* Buy tab */}
            {tab === 'buy' && (
                <>
                    {/* Search + sort */}
                    <div className="flex gap-2 mb-3">
                        <input type="text" placeholder="Поиск..." value={auctionSearch}
                            onChange={e => { setAuctionSearch(e.target.value); setPage(1); }}
                            className="flex-1 px-3 py-1.5 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-sm" />
                        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
                            className="px-2 py-1.5 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-sm w-32 cursor-pointer">
                            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                    </div>

                    {/* Categories */}
                    <div className="flex gap-1.5 mb-4 overflow-x-auto hide-scrollbar flex-wrap">
                        {CATEGORIES.map(c => (
                            <button key={c.key} onClick={() => { setCategory(c.key); setPage(1); }}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${category === c.key ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'}`}>
                                <Icon icon={c.icon} width="12" height="12" />{c.label}
                            </button>
                        ))}
                    </div>

                    {/* Top pagination */}
                    {totalPages > 1 && renderPagination()}

                    {loading ? (
                        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Загрузка...</p>
                    ) : lots.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-muted)]">{totalCount === 0 ? 'Нет активных лотов' : 'Нет лотов по фильтру'}</p>
                    ) : (
                        lots.map((lot: any) => {
                            const item = lot.itemData;
                            const stackCount = item.count || 1;
                            const isStack = stackCount > 1;
                            const totalPrice = lot.currentBid ?? lot.startPrice;
                            const pricePerItem = Math.ceil(totalPrice / stackCount);
                            const buyoutPerItem = lot.buyoutPrice ? Math.ceil(lot.buyoutPrice / stackCount) : pricePerItem;
                            const minBid = lot.currentBid ? lot.currentBid + Math.max(1, Math.floor(lot.currentBid * 0.05)) : lot.startPrice;
                            const hoursLeft = Math.max(0, Math.ceil((lot.endsAt - Date.now() / 1000) / 3600));

                            return (
                                <div key={lot.id} id={`auction-lot-${lot.id}`}>
                                <Card className={`mb-3 ${String(lot.id) === highlightLotId ? 'ring-2 ring-[var(--color-accent-warning)]' : ''}`}>
                                    <div className="flex justify-between items-start gap-3">
                                        <div onMouseEnter={e => showTooltip(e, item)} onMouseMove={moveTooltip} onMouseLeave={hideTooltip}
                                            onTouchStart={e => handleTouchStart(e, item)} onTouchEnd={handleTouchEnd} onContextMenu={e => e.preventDefault()}
                                            className="cursor-default flex gap-3 flex-1 min-w-0">
                                            <img src={getItemImage(item) || '/items/default.webp'} alt={item.name} className="w-10 h-10 object-contain rounded shrink-0" onError={e => { (e.target as HTMLImageElement).src = '/items/default.webp'; }} />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-sm truncate">{item.name}{isStack && <span className="text-xs text-[var(--color-accent-info)] ml-1">x{stackCount}</span>}</h3>
                                                <p className="text-xs text-[var(--color-text-muted)]">{item.rarity_display} • {lot.sellerName}</p>
                                                <p className="text-xs">Старт: {formatMoney(lot.startPrice)}{isStack && <span className="text-[var(--color-accent-info)]"> ({formatMoney(pricePerItem)} / шт)</span>}{lot.currentBid && <> • Ставка: {formatMoney(lot.currentBid)}{(lot.currentBidderName || lot.currentbiddername) && <> ({(lot.currentBidderName || lot.currentbiddername)})</>}</>}</p>
                                                {lot.buyoutPrice && <p className="text-xs">Выкуп: {formatMoney(lot.buyoutPrice)}{isStack && <span className="text-[var(--color-accent-info)]"> ({formatMoney(Math.ceil(lot.buyoutPrice / stackCount))} / шт)</span>}</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <div className="text-xs text-[var(--color-text-muted)]">{hoursLeft}ч</div>
                                            {lot.sellerId !== character?.id && (
                                                <div className="flex flex-col gap-1.5 items-end">
                                                    {lot.buyoutPrice && (
                                                        <Button size="xs" variant="primary" onClick={() => handleBuyout(lot.id)} disabled={(character?.money || 0) < lot.buyoutPrice}>
                                                            Выкупить {formatMoney(lot.buyoutPrice)}
                                                        </Button>
                                                    )}
                                                    <div className="flex items-end gap-1">
                                                        <input type="number" placeholder={String(minBid)} value={bidAmount[lot.id] || ''}
                                                            onChange={e => setBidAmount(prev => ({ ...prev, [lot.id]: e.target.value }))}
                                                            className="w-20 px-2 py-0.5 text-xs rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)]" />
                                                        <Button size="xs" variant="secondary" onClick={() => handleBid(lot.id, bidAmount[lot.id] || String(minBid), minBid)}>Ставка</Button>
                                                    </div>
                                                    {isStack && lot.buyoutPrice && (
                                                        <div className="flex items-end gap-1">
                                                            <input type="number" min={1} max={stackCount} placeholder="Кол-во"
                                                                value={partialQty[lot.id] || ''}
                                                                onChange={e => setPartialQty(prev => ({ ...prev, [lot.id]: parseInt(e.target.value) || 0 }))}
                                                                className="w-14 px-2 py-0.5 text-xs rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)]" />
                                                            <Button size="xs" variant="secondary" onClick={() => { const q = partialQty[lot.id] || 1; handleBuyPartial(lot.id, q); }}
                                                                disabled={(character?.money || 0) < buyoutPerItem * (partialQty[lot.id] || 1)}>
                                                                Купить
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {lot.sellerId === character?.id && (
                                                <Button size="xs" variant="danger" onClick={() => handleCancel(lot.id)} disabled={!!lot.currentBidderId}>Снять лот</Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                                </div>
                            );
                        })
                    )}

                    {/* Bottom pagination */}
                    {renderPagination()}
                </>
            )}

            {tooltip && (
                <div ref={tooltipRef} className="fixed z-50 pointer-events-none">
                    <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} />
                </div>
            )}
        </div>
    );
}
