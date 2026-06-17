import CharacterCard from './CharacterCard';
import StatAllocation from './StatAllocation';
import BuffsBlock from './BuffsBlock';
import { calculateStats } from '../utils/stats';
import type { Character } from '../contexts/GameContext';

interface LeftSidebarProps {
  character: Character;
  onEquip?: (slotId: string, itemId?: string) => void;
  selectedItemId?: string | null;
  highlightedSlots?: string[];
}

export default function LeftSidebar({ character, onEquip, selectedItemId, highlightedSlots }: LeftSidebarProps) {
  if (!character) return null;
  const drinkBonuses = character.drinkBonuses;
  const stats = calculateStats(character, drinkBonuses, character.collectionCount || 0);

  // Реген из комнаты
  const room = character.room;
  const now = Math.floor(Date.now() / 1000);
  let regenRate = 1;
  if (room && room.until > now) {
    if (room.type === 'closet') regenRate = 3;
    else if (room.type === 'bed') regenRate = 10;
    else if (room.type === 'chamber') regenRate = 50;
  }

  return (
    <div className="w-full sm:w-auto flex flex-col items-center sm:items-start">
      <CharacterCard
        char={{
          username: character.username,
          level: character.level,
          exp: character.exp,
          currentHp: character.currentHp,
          maxHp: stats.hp,
          equipment: character.equipment,
          stats: stats,
          gender: character.gender,
          guildName: character.guildName,
          guildId: character.guildId,
          avatar: character.avatar || null,
          baseStats: stats.baseStats,
          equipmentBonuses: stats.equipmentBonuses,
          extraStats: stats.extraStats,
          collectionBonus: character.collectionCount || 0,
        }}
        side="left"
        showHealth
        showExp
        regenRate={regenRate}
        readOnly={false}
        onEquip={onEquip}
        availableItems={character.inventory}
        selectedItemId={selectedItemId}
        highlightedSlots={highlightedSlots}
      />
      <StatAllocation />
      <BuffsBlock room={character.room} drink={character.drink} premium={character.premium} inventory={character.inventory} equipment={character.equipment} collectionCount={character.collectionCount || 0} totalCollectionItems={character.totalCollectionItems || 189} />
    </div>
  );
}
