import CharacterCard from './CharacterCard';
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
    <div>
      <CharacterCard
        char={{
          username: character.username,
          level: character.level,
          exp: character.exp,
          currentHp: character.currentHp,
          maxHp: stats.hp,
          stamina: 100,
          maxStamina: 100,
          equipment: character.equipment,
          stats: stats,
          gender: character.gender,
        }}
        side="left"
        showHealth
        showStamina={false}
        showExp
        readOnly={false}
        onEquip={onEquip}
        availableItems={character.inventory}
        selectedItemId={selectedItemId}
        highlightedSlots={highlightedSlots}
      />
    </div>
  );
}