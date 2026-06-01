export const slotNames: Record<string, string> = {
    helmet: 'Шлем', chest: 'Нагрудник', gloves: 'Перчатки', boots: 'Ботинки',
    amulet: 'Амулет', ring1: 'Кольцо', ring2: 'Кольцо', belt: 'Пояс',
    weapon1: 'Оружие 1', weapon2: 'Оружие 2',
};

export const slotCategories: Record<string, string> = {
    helmet: 'helmet', chest: 'chest', gloves: 'gloves', boots: 'boots',
    amulet: 'amulet', ring1: 'ring', ring2: 'ring', belt: 'belt',
    weapon1: 'weapon', weapon2: 'weapon',
};

const rarityColors = ['#888888', '#cccccc', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'];
const rarityColorNames = ['gray', 'white', 'green', 'blue', 'purple', 'yellow', 'red'];
const slotImageFolders: Record<string, string> = {
    weapon1: 'sword', weapon2: 'shield', ring1: 'ring', ring2: 'ring',
};

export function getRarityColor(item: any): string {
    return item?.rarity_color || (item?.rarity_id != null ? rarityColors[item.rarity_id] : undefined) || '#888';
}

export function getItemImage(item: any): string | null {
    if (item?.image) return item.image;
    if (item?.rarity_id == null) return null;
    const color = rarityColorNames[item.rarity_id] || 'gray';
    if (item?.type === 'craft_item' || item?.type === 'material') {
        return `fragment/fragment_${color}.webp`;
    }
    if (item?.slot) {
        const folder = slotImageFolders[item.slot] || item.slot;
        return `${folder}/${folder}_${color}.webp`;
    }
    return null;
}

export function isCraftItem(item: any): item is {
    type: string;
    rarity_id: number;
    count: number;
    name: string;
    id: string | number;
    itemType?: string;
    rarity_display?: string;
    rarity_color?: string;
    image?: string;
} {
    return item?.type === 'material' || item?.type === 'craft_item';
}

const typeNameRu: Record<string, string> = {
  craft: 'Материал',
  material: 'Материал',
  craft_item: 'Материал',
};

export function getItemTypeName(item: any): string {
  if (item?.slot) return slotNames[item.slot] || item.slot;
  return typeNameRu[item?.itemType || item?.type] || item?.itemType || item?.type || '?';
}

export function getCompatibleSlots(item: any): string[] {
    if (!item || item.type === 'material' || item.type === 'craft_item') return [];
    const slot = item.slot;
    const cat = slotCategories[slot] || slot;
    if (cat === 'ring') return ['ring1', 'ring2'];
    if (cat === 'weapon') {
        if (item.name?.includes('двуручн')) return ['weapon1'];
        return [slot];
    }
    return [slot];
}
