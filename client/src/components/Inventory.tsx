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
        <div className="w-full bg-[var(--color-bg-secondary)] rounded-xl p-4 border-2 border-[var(--color-border-light)] text-[var(--color-text-primary)]">
            <div className="flex items-center justify-between mb-2">
                <h3 className="m-0 flex items-center gap-1">
                    <Icon icon="game-icons:backpack" width="18" height="18" />
                    Инвентарь ({inventory.length}/{maxSlots})</h3>
                <button
                    onClick={() => setSortEquipment(nextSortOrder(sortEquipment))}
                    className="bg-transparent border border-[var(--color-border-light)] text-[var(--color-text-secondary)] rounded px-1.5 py-px cursor-pointer text-xs leading-none"
                    title="Сортировка снаряжения"
                >
                    {sortSymbol(sortEquipment)}
                </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,48px)] gap-2.5 mb-2">
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
                                        sendItemLink(item.id, item);
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

            <div className="flex justify-between items-center">
                <button onClick={handleExpand} className="bg-[var(--color-accent-info)] border-none text-white px-2.5 py-0.5 rounded cursor-pointer text-xs">
                    + Слот ({formatMoney(priceForNextSlot)})
                </button>
            </div>

            {hasMore && <div className="mt-2 text-[var(--color-text-muted)] text-xs">Есть ещё предметы вне инвентаря.</div>}

            <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                    <h4 className="m-0 text-sm">Ресурсы:</h4>
                    <button
                        onClick={() => setSortCraft(nextSortOrder(sortCraft))}
                        className="bg-transparent border border-[var(--color-border-light)] text-[var(--color-text-secondary)] rounded px-1.5 py-px cursor-pointer text-xs leading-none"
                        title="Сортировка ресурсов"
                    >
                        {sortSymbol(sortCraft)}
                    </button>
                </div>

                <div className="flex gap-1 mb-2 flex-wrap">
                    <button
                        onClick={() => setActiveType('all')}
                        className={`px-2 py-px text-xs rounded cursor-pointer border ${activeType === 'all' ? 'bg-[var(--color-border-default)] text-[var(--color-text-primary)] border-[var(--color-border-light)] font-bold' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border-[var(--color-border-default)] font-normal'}`}
                    >
                        Все
                    </button>
                    {uniqueTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setActiveType(type)}
                            className={`px-2 py-px text-xs rounded cursor-pointer border ${activeType === type ? 'bg-[var(--color-border-default)] text-[var(--color-text-primary)] border-[var(--color-border-light)] font-bold' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border-[var(--color-border-default)] font-normal'}`}
                        >
                            {getLocalizedType(type)}
                        </button>
                    ))}
                </div>

                {filteredCraft.length === 0 ? (
                    <div className="text-[var(--color-text-muted)] text-xs">Пусто</div>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
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
