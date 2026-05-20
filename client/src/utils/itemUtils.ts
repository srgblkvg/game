export const slotNames: Record<string, string> = {
    helmet: 'Шлем', chest: 'Нагрудник', gloves: 'Перчатки', boots: 'Ботинки',
    amulet: 'Амулет', ring1: 'Кольцо 1', ring2: 'Кольцо 2', belt: 'Пояс',
    weapon1: 'Оружие 1', weapon2: 'Оружие 2',
};

export const slotCategories: Record<string, string> = {
    helmet: 'helmet', chest: 'chest', gloves: 'gloves', boots: 'boots',
    amulet: 'amulet', ring1: 'ring', ring2: 'ring', belt: 'belt',
    weapon1: 'weapon', weapon2: 'weapon',
};

export function getRarityColor(rarity: number): string {
    const colors = ['#888', '#ccc', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'];
    return colors[rarity] || '#888';
}

export function isCraftItem(item: any): item is {
    type: string;          // 'material' | 'craft_item'
    rarity: number;
    count: number;
    name: string;
    id: string | number;
    itemType?: string;
} {
    return item?.type === 'material' || item?.type === 'craft_item';
}

export function getCompatibleSlots(item: any): string[] {
    if (!item || item.type === 'material') return [];
    const slot = item.slot;               // 'weapon1', 'weapon2', 'ring1', 'ring2', 'helmet', ...
    if (!slot) return [];

    // Двуручное оружие — только в weapon1
    if (item.name?.includes('двуручн') && slot.startsWith('weapon')) {
        return ['weapon1'];
    }

    // Кольца можно в оба слота
    if (slot === 'ring1' || slot === 'ring2') {
        return ['ring1', 'ring2'];
    }

    // Оружие — каждый только в свой слот
    if (slot === 'weapon1' || slot === 'weapon2') {
        return [slot];
    }

    // Всё остальное — точный слот
    return [slot];
}