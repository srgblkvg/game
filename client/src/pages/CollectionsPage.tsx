import { useState, useEffect, useCallback } from 'react';
import { getHeaders } from '../api/helpers';
import { getItemImage } from '../utils/itemUtils';
import ItemTooltip from '../components/ItemTooltip';
import { useLongPress } from '../hooks/useLongPress';

interface ShopItem {
    id: number;
    name: string;
    slot: string;
    rarity_id: number;
    rarity_display: string;
    rarity_color: string;
    bonuses: { s: number; a: number; d: number; m: number };
    extra: { crit: number; dodge: number; counter: number; fullBlock: number };
    image: string | null;
    price: number;
}

interface InventoryItem {
    id: number;
    name: string;
    slot: string;
    rarity_id: number;
    rarity_display: string;
    rarity_color: string;
    bonuses: any;
    extra: any;
    image: string | null;
}

interface CollectionSet {
    id: number;
    name: string;
    description: string;
    bonus_percent: number;
    sort_order: number;
    totalItems: number;
    collectedCount: number;
    completed: boolean;
}

const slotOrder = ['helmet', 'chest', 'gloves', 'boots', 'weapon1', 'shield', 'amulet', 'ring', 'belt'];

function CollectionSlot({ item, owned, collected, hasInventory, onAdd, onShowTooltip, onHideTooltip }: {
    item: ShopItem;
    owned: boolean;
    collected: boolean;
    hasInventory: boolean;
    onAdd: () => void;
    onShowTooltip: (e: React.TouchEvent | React.MouseEvent) => void;
    onHideTooltip: () => void;
}) {
    const canAdd = !collected && hasInventory;
    const longPress = useLongPress(onShowTooltip as any, canAdd ? onAdd : undefined);
    const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

    return (
        <div
            className={`relative aspect-square rounded-lg border bg-[var(--color-bg-secondary)] flex flex-col items-center justify-center p-1 transition-colors select-none ${
                owned && !collected
                    ? 'border-2 border-[#2ecc71] opacity-100 shadow-[0_0_8px_rgba(46,204,113,0.5)]'
                    : collected
                        ? 'border border-[var(--color-border-light)] opacity-100'
                        : 'border border-[var(--color-border-light)] opacity-40 grayscale'
            } ${canAdd ? 'cursor-pointer hover:border-[var(--color-accent-info)]' : ''}`}
            title={item.name}
            onMouseEnter={isTouchDevice ? undefined : onShowTooltip}
            onMouseLeave={isTouchDevice ? undefined : onHideTooltip}
            {...longPress}
            onClick={canAdd ? onAdd : undefined}
            onContextMenu={(e) => e.preventDefault()}
        >
            {getItemImage(item) ? (
                <img src={getItemImage(item)!} alt={item.name} className="w-full h-full object-contain"
                    style={collected || owned ? {} : { filter: 'grayscale(100%) brightness(0.6)' }} />
            ) : (
                <span className="text-[0.5rem] text-[var(--color-text-muted)] text-center leading-tight">{item.name}</span>
            )}
            <span className="text-[0.5rem] text-[var(--color-text-muted)] mt-0.5 leading-none text-center truncate w-full px-0.5">{item.name}</span>
            {collected && <span className="absolute top-0.5 left-0.5 text-[0.5rem]">✓</span>}
        </div>
    );
}

export default function CollectionsPage() {
    const [items, setItems] = useState<ShopItem[]>([]);
    const [ownedKeys, setOwnedKeys] = useState<Set<string>>(new Set());
    const [collectionKeys, setCollectionKeys] = useState<Set<string>>(new Set());
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [sets, setSets] = useState<CollectionSet[]>([]);
    const [collectionCount, setCollectionCount] = useState(0);
    const [totalCollectionItems, setTotalCollectionItems] = useState(189);
    const [loading, setLoading] = useState(true);

    const [selectedShopItem, setSelectedShopItem] = useState<ShopItem | null>(null);
    const [selectedInvItem, setSelectedInvItem] = useState<InventoryItem | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        Promise.all([
            fetch('/api/items', { headers: getHeaders() }).then(r => r.json()),
            fetch('/api/character/me', { headers: getHeaders() }).then(r => r.json()),
            fetch('/api/collections', { headers: getHeaders() }).then(r => r.json()),
        ])
            .then(([shopItems, character, collectionData]) => {
                setItems(shopItems);
                setSets(collectionData.sets || []);
                setCollectionCount(character.collectionCount || 0);
                setTotalCollectionItems(character.totalCollectionItems || 189);

                const inv = character.inventory || [];
                setInventoryItems(inv);

                const owned = new Set<string>();
                for (const invItem of inv) {
                    if (invItem.name && invItem.slot) owned.add(`${invItem.name}|${invItem.slot}`);
                }
                setOwnedKeys(owned);

                const collItems = collectionData.items || [];
                const coll = new Set<string>();
                for (const c of collItems) {
                    coll.add(`${c.itemName}|${c.slot}`);
                }
                setCollectionKeys(coll);

                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleAddToCollection = (shopItem: ShopItem) => {
        const matching = inventoryItems.filter(inv => inv.name === shopItem.name && inv.slot === shopItem.slot);
        if (matching.length === 0) {
            setMessage('Нет подходящих предметов в инвентаре');
            return;
        }
        setSelectedShopItem(shopItem);
        setSelectedInvItem(matching[0]);
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        if (!selectedInvItem || !selectedShopItem) return;
        try {
            const res = await fetch('/api/collections/add', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemName: selectedShopItem.name, slot: selectedShopItem.slot, itemId: selectedInvItem.id }),
            });
            const data = await res.json();
            if (!res.ok) { setMessage(data.error || 'Ошибка'); return; }

            const [charRes, collRes] = await Promise.all([
                fetch('/api/character/me', { headers: getHeaders() }).then(r => r.json()),
                fetch('/api/collections', { headers: getHeaders() }).then(r => r.json()),
            ]);

            setInventoryItems(charRes.inventory || []);
            setCollectionCount(charRes.collectionCount || 0);
            setSets(collRes.sets || []);

            const newOwned = new Set<string>();
            for (const invItem of (charRes.inventory || [])) {
                if (invItem.name && invItem.slot) newOwned.add(`${invItem.name}|${invItem.slot}`);
            }
            setOwnedKeys(newOwned);

            const newColl = new Set<string>();
            for (const c of (collRes.items || [])) {
                newColl.add(`${c.itemName}|${c.slot}`);
            }
            setCollectionKeys(newColl);

            setSelectedShopItem(null);
            setSelectedInvItem(null);
            setShowConfirm(false);
            setMessage('');
        } catch { setMessage('Ошибка сети'); }
    };

    if (loading) {
        return <div className="p-4 max-w-4xl mx-auto"><h1 className="text-xl font-bold mb-4">Коллекция</h1><p className="text-sm text-[var(--color-text-muted)]">Загрузка...</p></div>;
    }

    const totalPercent = Math.round((collectionCount / totalCollectionItems) * 100);

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <h1 className="text-xl font-bold mb-2">Коллекция — {totalPercent}%</h1>

            {/* Бонус */}
            <div className="mb-3 p-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
                <p className="text-xs font-medium mb-1">Текущий бонус</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                    Собрано: <span className="text-[var(--color-accent-gold)] font-medium">{collectionCount}/{totalCollectionItems}</span>
                    {collectionCount > 0 && (
                        <span> — <span className="text-[var(--color-accent-success)]">+{collectionCount}%</span> к Силе, Ловкости, Защите, Мастерству и HP</span>
                    )}
                </p>
            </div>

            {/* Описание механики */}
            <div className="mb-4 p-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
                <details className="text-xs text-[var(--color-text-muted)]">
                    <summary className="cursor-pointer hover:text-[var(--color-text-primary)] font-medium">Как работает коллекция?</summary>
                    <p className="mt-1">
                        Каждый собранный предмет даёт <span className="text-[var(--color-accent-success)]">+1%</span> к основным характеристикам (Сила, Ловкость, Защита, Мастерство) и HP.
                        В одном сете <span className="text-[var(--color-accent-gold)]">27</span> предметов (9 слотов × 3 варианта). Всего <span className="text-[var(--color-accent-gold)]">7</span> сетов — <span className="text-[var(--color-accent-gold)]">189</span> предметов.
                        Максимальный бонус: <span className="text-[var(--color-accent-gold)]">+189%</span>.
                    </p>
                </details>
            </div>

            {/* Сеты */}
            <div className="space-y-4 mb-6">
                {sets.map(set => (
                    <SetBlock
                        key={set.id}
                        set={set}
                        items={items}
                        ownedKeys={ownedKeys}
                        collectionKeys={collectionKeys}
                        inventoryItems={inventoryItems}
                        onAddToCollection={handleAddToCollection}
                    />
                ))}
            </div>

            {items.length === 0 && !loading && (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-10">Предметы не найдены</p>
            )}

            {/* Modal: confirm */}
            {showConfirm && selectedShopItem && selectedInvItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setShowConfirm(false); setSelectedInvItem(null); }}>
                    <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border-default)] p-4 w-80" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-sm mb-2 text-[var(--color-accent-danger)]">Подтверждение</h3>
                        <p className="text-xs mb-3">
                            Предмет <span className="font-medium">{selectedInvItem.name}</span> будет безвозвратно помещён в коллекцию и <span className="text-[var(--color-accent-danger)]">исчезнет</span> из инвентаря.
                        </p>
                        {message && <p className="text-xs text-[var(--color-accent-danger)] mb-2">{message}</p>}
                        <div className="flex gap-2">
                            <button className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--color-accent-danger)] text-white font-medium hover:opacity-90" onClick={handleConfirm}>
                                Поместить в коллекцию
                            </button>
                            <button className="flex-1 text-xs py-1.5 rounded-lg border border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
                                onClick={() => { setShowConfirm(false); setSelectedInvItem(null); }}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SetBlock({ set, items, ownedKeys, collectionKeys, inventoryItems, onAddToCollection }: {
    set: CollectionSet;
    items: ShopItem[];
    ownedKeys: Set<string>;
    collectionKeys: Set<string>;
    inventoryItems: InventoryItem[];
    onAddToCollection: (item: ShopItem) => void;
}) {
    const [collapsed, setCollapsed] = useState(true);
    const [tooltip, setTooltip] = useState<{ item: ShopItem; x: number; y: number } | null>(null);

    const showTooltip = useCallback((item: ShopItem, e: React.TouchEvent | React.MouseEvent) => {
        const pos = 'touches' in e ? e.touches[0] : e;
        setTooltip({ item, x: pos.clientX, y: pos.clientY });
    }, []);
    const hideTooltip = useCallback(() => setTooltip(null), []);

    useEffect(() => {
        if (!tooltip) return;
        const handler = () => setTooltip(null);
        document.addEventListener('touchstart', handler);
        document.addEventListener('click', handler);
        return () => {
            document.removeEventListener('touchstart', handler);
            document.removeEventListener('click', handler);
        };
    }, [tooltip]);

    // Filter items that belong to this set (by name+slot from collection_set_items via API)
    // We don't have set items from API, so we use items matching the set's collected items
    // Instead, use all items grouped by rarity which matches the default sets
    const rarityId = set.sort_order - 1; // hack: sort_order matches rarity+1
    const setItems = items.filter(item => item.rarity_id === rarityId).sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));

    const color = ['#888888', '#cccccc', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'][rarityId] || '#888';

    // Есть ли предметы в инвентаре, которые можно добавить в этот сет
    const hasAddableItems = setItems.some(item => {
        if (collectionKeys.has(`${item.name}|${item.slot}`)) return false;
        return inventoryItems.some(inv => inv.name === item.name && inv.slot === item.slot);
    });

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between cursor-pointer select-none border-b border-[var(--color-border-light)] pb-1 mb-2"
                onClick={() => setCollapsed(!collapsed)}>
                <div className="flex items-center gap-2">
                    <span className="text-xs">{collapsed ? '▶' : '▼'}</span>
                    <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color }}>
                        {set.name}
                    </h2>
                    {hasAddableItems && (
                        <span className="w-2 h-2 rounded-full bg-[#2ecc71] flex-shrink-0" />
                    )}
                    <span className="text-xs text-[var(--color-text-muted)]">{set.collectedCount}/{set.totalItems}</span>
                    {set.completed && <span className="text-xs text-[var(--color-accent-success)]">✓ +{set.bonus_percent}%</span>}
                </div>
            </div>
            {!collapsed && (
                <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-10 gap-1.5">
                    {setItems.map(item => {
                        const owned = ownedKeys.has(`${item.name}|${item.slot}`);
                        const collected = collectionKeys.has(`${item.name}|${item.slot}`);
                        const matchingInventory = inventoryItems.filter(inv => inv.name === item.name && inv.slot === item.slot);

                        return (
                            <CollectionSlot
                                key={item.id}
                                item={item}
                                owned={owned}
                                collected={collected}
                                hasInventory={matchingInventory.length > 0}
                                onAdd={() => onAddToCollection(item)}
                                onShowTooltip={(e) => showTooltip(item, e)}
                                onHideTooltip={hideTooltip}
                            />
                        );
                    })}
                </div>
            )}
            {tooltip && <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} />}
        </div>
    );
}
