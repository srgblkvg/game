import CharacterCard from './CharacterCard';
import StatAllocation from './StatAllocation';
import BuffsBlock from './BuffsBlock';
import AchievementsBlock from './AchievementsBlock';
import { useGame, type Character } from '../contexts/GameContext';
import { toCharCardData } from '../utils/character';

interface LeftSidebarProps {
  character: Character;
  onEquip?: (slotId: string, itemId?: string) => void;
  selectedItemId?: string | null;
  highlightedSlots?: string[];
}

export default function LeftSidebar({ character, onEquip, selectedItemId, highlightedSlots }: LeftSidebarProps) {
  if (!character) return null;
  const { serverTime, regenHp } = useGame();
  const stats = character.stats || { s: 0, a: 0, d: 0, m: 0, hp: 100 };
  const effectiveRoom = character.room;

  return (
    <div className="w-full sm:w-[240px] flex flex-col items-center sm:items-start">
      <CharacterCard
        char={toCharCardData(character, { currentHp: regenHp, maxHp: stats.hp })}
        side="left"
        showHealth
        showExp
        regenRate={((): number => {
          let rate = 1;
          if (effectiveRoom && effectiveRoom.until > serverTime) {
            if (effectiveRoom.type === 'closet') rate = 3;
            else if (effectiveRoom.type === 'bed') rate = 10;
            else if (effectiveRoom.type === 'chamber') rate = 50;
          }
          if ((character.premium?.until || 0) > serverTime) rate *= 3;
          return rate;
        })()}
        readOnly={false}
        profileId={character.id}
        onEquip={onEquip}
        availableItems={character.inventory}
        selectedItemId={selectedItemId}
        highlightedSlots={highlightedSlots}
      />
      <StatAllocation />
      <BuffsBlock room={effectiveRoom} drink={character.drink} premium={character.premium} inventory={character.inventory} equipment={character.equipment} collectionCount={character.collectionCount || 0} totalCollectionItems={character.totalCollectionItems || 189} />
      <AchievementsBlock />
    </div>
  );
}
