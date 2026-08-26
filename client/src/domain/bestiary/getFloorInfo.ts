export interface LootImage {
  rarity: number;
  name: string;
  image: string;
  chance: number | string;
  [key: string]: unknown;
}

export interface ItemDrop {
  rarity: number;
  chance: number;
  [key: string]: unknown;
}

export interface EquipmentDrop {
  rarity: number | string;
  chance: number | string;
  setChance?: number | string | null;
  [key: string]: unknown;
}

export interface ArtifactMaterialDrop {
  name: string;
  chance: number | string;
  [key: string]: unknown;
}

export interface FloorMob {
  location: string;
  level: number;
  gold_min: number;
  gold_max: number;
  xp?: number | null;
  lootImages?: LootImage[] | null;
  itemDropTable?: ItemDrop[] | null;
  equipmentDrops?: EquipmentDrop[] | null;
  artifactMaterialDrop?: ArtifactMaterialDrop | null;
  [key: string]: unknown;
}

export interface FloorInfo {
  count: number;
  minLevel: number;
  maxLevel: number;
  goldMin: number;
  goldMax: number;
  avgXp: number;
  lootImages: LootImage[];
  itemDropTable: ItemDrop[];
  equipmentDrops: EquipmentDrop[];
  craftMaterials: LootImage[];
  upgradeStones: LootImage[];
  artifactMaterials: ArtifactMaterialDrop[];
  setChance: number;
}

export function getFloorInfo(mobs: readonly FloorMob[], floor: string): FloorInfo {
  const fm = mobs.filter(m => m.location === floor).sort((a, b) => a.level - b.level);
  const goldMin = fm.reduce((min, m) => Math.min(min, m.gold_min), Infinity);
  const goldMax = fm.reduce((max, m) => Math.max(max, m.gold_max), 0);
  const avgXp = fm.length > 0 ? Math.round(fm.reduce((sum, m) => sum + (m.xp || 0), 0) / fm.length) : 0;

  const lootImageMap = new Map<string, LootImage>();
  for (const mob of fm) {
    if (mob.lootImages) {
      for (const lootImage of mob.lootImages) {
        const key = lootImage.rarity === -1 ? `stone:${lootImage.name}` : `material:${lootImage.rarity}`;
        const current = lootImageMap.get(key);
        if (!current || Number(lootImage.chance) > Number(current.chance)) lootImageMap.set(key, lootImage);
      }
    }
  }
  const lootImages = Array.from(lootImageMap.values());

  const itemDropMap = new Map<number, number>();
  for (const mob of fm) {
    if (mob.itemDropTable) {
      for (const item of mob.itemDropTable) {
        const previous = itemDropMap.get(item.rarity);
        if (!previous || item.chance > previous) itemDropMap.set(item.rarity, item.chance);
      }
    }
  }
  const itemDropTable = Array.from(itemDropMap.entries()).map(([rarity, chance]) => ({ rarity, chance }));

  const equipmentDropMap = new Map<number, EquipmentDrop>();
  const artifactMaterialMap = new Map<string, ArtifactMaterialDrop>();
  for (const mob of fm) {
    for (const drop of mob.equipmentDrops || []) {
      const current = equipmentDropMap.get(Number(drop.rarity));
      if (!current || Number(drop.chance) > Number(current.chance)) equipmentDropMap.set(Number(drop.rarity), drop);
    }
    const material = mob.artifactMaterialDrop;
    if (material) {
      const current = artifactMaterialMap.get(material.name);
      if (!current || Number(material.chance) > Number(current.chance)) artifactMaterialMap.set(material.name, material);
    }
  }
  const equipmentDrops = Array.from(equipmentDropMap.values()).sort((a, b) => Number(a.rarity) - Number(b.rarity));
  const craftMaterials = lootImages.filter(item => item.rarity >= 0);
  const upgradeStones = lootImages.filter(item => item.rarity === -1);
  const artifactMaterials = Array.from(artifactMaterialMap.values());
  const setChance = fm.length > 0
    ? fm.reduce(
      (sum, mob) => sum + (mob.equipmentDrops || []).reduce(
        (mobSum, item) => mobSum + Number(item.setChance || 0),
        0,
      ),
      0,
    ) / fm.length
    : 0;

  return {
    count: fm.length,
    minLevel: fm[0]?.level || 0,
    maxLevel: fm[fm.length - 1]?.level || 0,
    goldMin,
    goldMax,
    avgXp,
    lootImages,
    itemDropTable,
    equipmentDrops,
    craftMaterials,
    upgradeStones,
    artifactMaterials,
    setChance,
  };
}
