// Общие типы предметов, используемые в нескольких компонентах

export interface GameItem {
  id: number | string;
  name: string;
  slot?: string;
  rarity_id?: number;
  rarity_display?: string;
  rarity_color?: string;
  rarity?: number;
  type?: 'craft_item' | 'material' | 'item';
  itemType?: string;
  count?: number;
  image?: string | null;
  bonuses?: Record<string, number>;
  extra?: Record<string, number>;
  upgradeLevel?: number;
}
