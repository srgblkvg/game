export const HUNT_DROP_MULTIPLIER = 2 / 3;
// Bestiary показывает эти значения; те же константы используются фактическими роллами.
export const MATERIAL_DROP_CHANCE = 0.35 * HUNT_DROP_MULTIPLIER;
export const STONE_DROP_CHANCE = 0.05 * HUNT_DROP_MULTIPLIER;
export const MYTHIC_RESOURCE_DROP_CHANCE = 0.01 * HUNT_DROP_MULTIPLIER;

export interface DropChanceEntry {
    rarity: number;
    chance: number;
}

export function getCraftMaterialChance(rarityWeight: number): number {
    return Math.max(0, Number(rarityWeight) || 0) * MATERIAL_DROP_CHANCE;
}

export function getStoneChance(weight: number, totalWeight: number): number {
    if (totalWeight <= 0) return 0;
    return Math.max(0, Number(weight) || 0) / totalWeight * STONE_DROP_CHANCE;
}

export function scaleItemDropTable<T extends DropChanceEntry>(table: T[]): T[] {
    return table.map(entry => ({ ...entry, chance: entry.chance * HUNT_DROP_MULTIPLIER }));
}
