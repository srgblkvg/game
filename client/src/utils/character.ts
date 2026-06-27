import type { Character } from '../contexts/GameContext';
import type { CharacterCardData } from '../types/character';

/** Собрать CharacterCardData из Character — ЕДИНСТВЕННОЕ место */
export function toCharCardData(
  character: Character,
  overrides?: Partial<CharacterCardData>
): CharacterCardData {
  return {
    username: character.username,
    level: character.level,
    exp: character.exp,
    equipment: character.equipment,
    stats: character.stats,
    gender: character.gender || 'male',
    guildName: character.guildName ?? undefined,
    guildId: character.guildId ?? undefined,
    avatar: character.avatar || null,
    baseStats: character.baseStats,
    equipmentBonuses: character.drinkBonuses,
    extraStats: undefined,
    collectionCount: character.collectionCount || 0,
    guildBonus: undefined,
    buildings: [],
    ...overrides,
  };
}
