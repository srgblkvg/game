export type InventorySortOrder = 'none' | 'asc' | 'desc';

export type InventorySortableItem = {
    rarity_id?: number | null;
};

export function sortInventoryItems<T extends InventorySortableItem>(items: T[], order: InventorySortOrder): T[] {
    if (order === 'none') return items;
    return [...items].sort((a, b) => {
        const rarityA = a.rarity_id ?? 0;
        const rarityB = b.rarity_id ?? 0;
        return order === 'asc' ? rarityA - rarityB : rarityB - rarityA;
    });
}
