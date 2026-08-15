export function lootGroupKey(reward: any, kind: 'item' | 'page'): string {
    if (kind === 'page') return `page:${reward.skillId}`;
    if (reward.type === 'craft_item' || reward.itemType === 'upgrade') return `stack:${reward.id}`;
    return `equipment:${JSON.stringify({
        name: reward.name,
        slot: reward.slot,
        rarity_id: reward.rarity_id,
        upgradeLevel: reward.upgradeLevel ?? reward.upgradelevel ?? 0,
        bonuses: reward.bonuses || {},
        extra: reward.extra || {},
        image: reward.image || '',
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
            else grouped.set(key, { ...reward, count: reward.count || 1 });
        }
        return Array.from(grouped.values());
    };
    return { items: group(items, 'item'), pages: group(pages, 'page') };
}
