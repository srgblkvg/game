import { normalizeItem } from '../domain/items/normalizeItem';

export function lootGroupKey(reward: any, kind: 'item' | 'page'): string {
    if (kind === 'page') return `page:${reward.skillId}`;
    const item = normalizeItem(reward);
    if (item.type === 'craft_item' || item.itemType === 'upgrade') return `stack:${item.id}`;
    return `equipment:${JSON.stringify({
        name: item.name,
        slot: item.slot,
        rarity_id: item.rarity_id,
        upgradeLevel: item.upgradeLevel ?? 0,
        bonuses: item.bonuses || {},
        extra: item.extra || {},
        image: item.image || '',
    })}`;
}

export function groupLoot(items: any[], pages: any[]): { items: any[]; pages: any[] } {
    const group = (rewards: any[], kind: 'item' | 'page') => {
        const grouped = new Map<string, any>();
        for (const reward of rewards) {
            if (!reward) continue;
            const key = lootGroupKey(reward, kind);
            const existing = grouped.get(key);
            if (existing) existing.count = (existing.count || 1) + (reward.count || 1);
            else grouped.set(key, { ...normalizeItem(reward), count: reward.count || 1 });
        }
        return Array.from(grouped.values());
    };
    return { items: group(items, 'item'), pages: group(pages, 'page') };
}
