import { useState, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { expandInventory } from '../api';
import { formatMoney } from '../utils/money';
import { isCraftItem } from '../utils/itemUtils';
import LongPressItemSlot from './LongPressItemSlot';
import LongPressResourceSlot from './LongPressResourceSlot';
import ItemTooltip from './ItemTooltip';
import { useGlobalChat } from '../contexts/ChatContext';

interface InventoryProps {
    onItemClick?: (item: any) => void;
    onMaterialClick?: (item: any) => void;
    inventoryOverride?: any[];
    selectedItemId?: string | null;
    onDragStartItem?: () => void;
}

type SortOrder = 'none' | 'asc' | 'desc';

const nextSortOrder = (order: SortOrder): SortOrder => {
    if (order === 'none') return 'asc';
    if (order === 'asc') return 'desc';
    return 'none';
};

const sortItems = (items: any[], order: SortOrder): any[] => {
    if (order === 'none') return items;
    return [...items].sort((a, b) => {
        const rarityA = a.rarity_id ?? 0;
        const rarityB = b.rarity_id ?? 0;
        return order === 'asc' ? rarityA - rarityB : rarityB - rarityA;
    });
};

const typeLocalization: Record<string, string> = {
    'craft': 'Материалы',
    'upgrade': 'Камни усиления',
};

const getLocalizedType = (type: string): string => {
    return typeLocalization[type] || type;
};

export default function Inventory({
    onItemClick,
    onMaterialClick,
    inventoryOverride,
    selectedItemId,
    onDragStartItem,
}: InventoryProps) {
    const { character, setCharacter } = useGame();
    const { user } = useAuth();
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const { sendItemLink } = useGlobalChat();

    const [sortEquipment, setSortEquipment] = useState<SortOrder>('none');
    const [sortCraft, setSortCraft] = useState<SortOrder>('none');
    const [activeType, setActiveType] = useState<string>('all');

    // Закрытие тултипа при любом клике в документе
    useEffect(() => {
        const handleGlobalClick = () => setTooltipData(null);
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, []);

    if (!character || !user) return null;

    const maxSlots = character.inventorySlots || 10;
    const allItems = inventoryOverride ?? character.inventory;

    const equipmentItems = allItems.filter((item: any) => !isCraftItem(item));
    const craftItems = allItems.filter((item: any) => isCraftItem(item));

    const uniqueTypes = useMemo(() => {
        const typeSet = new Set<string>();
        craftItems.forEach(item => {
            typeSet.add(item.itemType || 'craft');
        });
        return Array.from(typeSet).sort();
    }, [craftItems]);

    const sortedEquipment = sortItems(equipmentItems, sortEquipment);
    const inventory = sortedEquipment.slice(0, maxSlots);
    const hasMore = equipmentItems.length > maxSlots;

    const handleExpand = async () => {
        try {
            const result = await expandInventory();
            setCharacter({ ...character, inventorySlots: result.inventorySlots, money: result.moneyAfter });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        e.dataTransfer.setData('text/plain', itemId);
        e.dataTransfer.effectAllowed = 'move';
        onDragStartItem?.();
    };

    const handleMouseEnter = (e: React.MouseEvent, item: any) => {
        setTooltipData({ item, x: e.clientX, y: e.clientY });
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (tooltipData) setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };
    const handleMouseLeave = () => setTooltipData(null);

    const priceForNextSlot = 100 * Math.pow(2, maxSlots - 10);

    const sortSymbol = (order: SortOrder) => {
        if (order === 'none') return '⇅';
        if (order === 'asc') return '↑';
        return '↓';
    };

    const filteredCraft = useMemo(() => {
        let items = craftItems;
        if (activeType !== 'all') {
            items = items.filter(item => (item.itemType || 'craft') === activeType);
        }
        return sortItems(items, sortCraft);
    }, [craftItems, activeType, sortCraft]);

    const handleLongPress = (item: any, e: React.TouchEvent | React.MouseEvent) => {
        const touch = (e as React.TouchEvent).touches?.[0] ?? e;
        setTooltipData({ item, x: touch.clientX, y: touch.clientY });
    };

    return (
        <div style={{ width: '100%', background: '#1e1e30', borderRadius: '12px', padding: '1rem', border: '2px solid #555', color: '#eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon icon="game-icons:backpack" width="18" height="18" />
                    Инвентарь ({inventory.length}/{maxSlots})</h3>
                <button
                    onClick={() => setSortEquipment(nextSortOrder(sortEquipment))}
                    style={{
                        background: 'transparent',
                        border: '1px solid #555',
                        color: '#ccc',
                        borderRadius: '4px',
                        padding: '0.1rem 0.4rem',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        lineHeight: 1,
                    }}
                    title="Сортировка снаряжения"
                >
                    {sortSymbol(sortEquipment)}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 48px)', gap: '10px', marginBottom: '0.5rem' }}>
                {Array.from({ length: maxSlots }).map((_, idx) => {
                    const item = inventory[idx] || null;
                    const isSelected = selectedItemId && item && item.id === selectedItemId;

                    return (
                        <LongPressItemSlot
                            key={idx}
                            item={item}
                            draggable={!!item && !isCraftItem(item)}
                            onDragStart={item && !isCraftItem(item) ? (e) => handleDragStart(e, item.id) : undefined}
                            onClick={(e) => {
                                if (item && !isCraftItem(item)) {
                                    if (e.shiftKey) {
                                        e.stopPropagation();
                                        sendItemLink(item.id);
                                    } else if (onItemClick) {
                                        setTooltipData(null);
                                        onItemClick(item);
                                    }
                                }
                            }}
                            onMouseEnter={(e) => item && handleMouseEnter(e, item)}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onLongPress={handleLongPress}
                            highlighted={isSelected}
                        />
                    );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={handleExpand} style={{ background: '#3498db', border: 'none', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    + Слот ({formatMoney(priceForNextSlot)})
                </button>
            </div>

            {hasMore && <div style={{ marginTop: '0.5rem', color: '#888', fontSize: '0.8rem' }}>Есть ещё предметы вне инвентаря.</div>}

            <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Ресурсы:</h4>
                    <button
                        onClick={() => setSortCraft(nextSortOrder(sortCraft))}
                        style={{
                            background: 'transparent',
                            border: '1px solid #555',
                            color: '#ccc',
                            borderRadius: '4px',
                            padding: '0.1rem 0.4rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            lineHeight: 1,
                        }}
                        title="Сортировка ресурсов"
                    >
                        {sortSymbol(sortCraft)}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveType('all')}
                        style={{
                            padding: '0.1rem 0.5rem',
                            fontSize: '0.75rem',
                            background: activeType === 'all' ? '#444' : '#222',
                            color: activeType === 'all' ? '#fff' : '#aaa',
                            border: `1px solid ${activeType === 'all' ? '#666' : '#444'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: activeType === 'all' ? 'bold' : 'normal',
                        }}
                    >
                        Все
                    </button>
                    {uniqueTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setActiveType(type)}
                            style={{
                                padding: '0.1rem 0.5rem',
                                fontSize: '0.75rem',
                                background: activeType === type ? '#444' : '#222',
                                color: activeType === type ? '#fff' : '#aaa',
                                border: `1px solid ${activeType === type ? '#666' : '#444'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: activeType === type ? 'bold' : 'normal',
                            }}
                        >
                            {getLocalizedType(type)}
                        </button>
                    ))}
                </div>

                {filteredCraft.length === 0 ? (
                    <div style={{ color: '#888', fontSize: '0.8rem' }}>Пусто</div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {filteredCraft.map((item: any) => (
                            <LongPressResourceSlot
                                key={item.id}
                                item={item}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                onClick={(e) => {
                                    if (e.shiftKey) {
                                        e.stopPropagation(); // Предотвращаем сворачивание чата
                                        sendItemLink(item.id, item);
                                        return;
                                    }
                                    setTooltipData(null);
                                    onMaterialClick?.(item);
                                }}
                                onMouseEnter={(e) => handleMouseEnter(e, item)}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                onLongPress={handleLongPress}
                            />
                        ))}
                    </div>
                )}
            </div>

            {tooltipData && <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />}
        </div>
    );
}