import CharacterCard from './CharacterCard';
import StatAllocation from './StatAllocation';
import BuffsBlock from './BuffsBlock';
import { useGame, getRegenHp, type Character } from '../contexts/GameContext';
import { toCharCardData } from '../utils/character';

interface LeftSidebarProps {
  character: Character;
  onEquip?: (slotId: string, itemId?: string) => void;
  selectedItemId?: string | null;
  highlightedSlots?: string[];
}

export default function LeftSidebar({ character, onEquip, selectedItemId, highlightedSlots }: LeftSidebarProps) {
  if (!character) return null;
  const { serverTime } = useGame();
  const stats = character.stats || { s: 0, a: 0, d: 0, m: 0, hp: 100 };
  // Премиум активирует комнату «Чулан», если нет своей
  const effectiveRoom = character.room || ((character.premium?.until || 0) > serverTime ? { type: 'closet' as const, until: character.premium!.until } : null);
  const regenHp = getRegenHp(character.currentHp, stats.hp, serverTime, effectiveRoom?.type, effectiveRoom?.until);

  return (
    <div className="w-full sm:w-auto flex flex-col items-center sm:items-start">
      <CharacterCard
        char={toCharCardData(character, { currentHp: regenHp, maxHp: stats.hp })}
        side="left"
        showHealth
        showExp
        regenRate={effectiveRoom && effectiveRoom.until > serverTime ? (effectiveRoom.type === 'closet' ? 3 : effectiveRoom.type === 'bed' ? 10 : 50) : 1}
        readOnly={false}
        onEquip={onEquip}
        availableItems={character.inventory}
        selectedItemId={selectedItemId}
        highlightedSlots={highlightedSlots}
      />
      <StatAllocation />
      <BuffsBlock room={effectiveRoom} drink={character.drink} premium={character.premium} inventory={character.inventory} equipment={character.equipment} collectionCount={character.collectionCount || 0} totalCollectionItems={character.totalCollectionItems || 189} />
    </div>
  );
}
