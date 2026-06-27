import type { GameItem } from './items';

export interface CharacterData {
  id: number;
  username: string;
  level: number;
  exp?: number;
  money?: number;
  totalBattles?: number;
  wins?: number;
  inventory: GameItem[];
  equipment: Record<string, GameItem>;
  baseStats?: { s: number; a: number; d: number; m: number };
  currentHp?: number;
  stats?: { s: number; a: number; d: number; m: number; hp: number };
  lastAttackTime?: number;
  protectionUntil?: number;
  inventorySlots?: number;
  activeJob?: any;
  role?: string;
  openPrivateTabs?: number[];
  gender?: string;
  statPoints?: number;
}

export interface CharacterCardData {
  username: string;
  level: number;
  exp?: number;
  currentHp?: number;
  maxHp?: number;
  equipment: Record<string, any>;
  stats?: { s: number; a: number; d: number; m: number; hp?: number };
  gender?: string;
  avatar?: string | null;
  baseStats?: { s: number; a: number; d: number; m: number };
  equipmentBonuses?: { s: number; a: number; d: number; m: number };
  extraStats?: { crit: number; dodge: number; counter: number; fullBlock: number };
  guildName?: string;
  guildId?: number;
  guildBonus?: number;
  buildings?: { type: string; icon: string; label: string; level: number; bonus: number }[];
  collectionCount?: number;
}
