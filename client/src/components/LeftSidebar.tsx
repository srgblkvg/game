import CharacterCard from './CharacterCard';
import StatAllocation from './StatAllocation';
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
  const stats = calculateStats(character);

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
        }}
        side="left"
        showHealth
        showExp
        readOnly={false}
        onEquip={onEquip}
        availableItems={character.inventory}
        selectedItemId={selectedItemId}
        highlightedSlots={highlightedSlots}
      />
      <StatAllocation />
    </div>
  );
}
