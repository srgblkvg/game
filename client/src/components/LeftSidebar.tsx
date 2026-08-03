import CharacterCard from './CharacterCard';
import StatAllocation from './StatAllocation';
import BuffsBlock from './BuffsBlock';
import AchievementsBlock from './AchievementsBlock';
import { useGame, type Character } from '../contexts/GameContext';
import { toCharCardData } from '../utils/character';
import { getHeaders } from '../api/helpers';

interface LeftSidebarProps {
  character: Character;
  onEquip?: (slotId: string, itemId?: string) => void;
  selectedItemId?: string | null;
  highlightedSlots?: string[];
}

export default function LeftSidebar({ character, onEquip, selectedItemId, highlightedSlots }: LeftSidebarProps) {
  if (!character) return null;
  const { serverTime, regenHp, setCharacter } = useGame();
  const stats = character.stats || { s: 0, a: 0, d: 0, m: 0, hp: 100 };
  const effectiveRoom = character.room;

  const equipSets = (character as any).equipment1 !== undefined ? {
    1: (character as any).equipment1 || {},
    2: (character as any).equipment2 || {},
    3: (character as any).equipment3 || {},
  } : undefined;
  const activeSlot = (character as any).activeEquipSlot || 1;

  const handleSwitchSet = async (slot: number) => {
    if (slot === activeSlot) return;
    try {
      const res = await fetch('/api/character/switch-equip', {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      if (res.ok) {
        const data = await res.json();
        setCharacter((prev: Character | null) => {
          if (!prev) return prev;
          // Сохраняем текущий equipment в старый слот, загружаем новый
          const newEquipSets: any = { ...(prev as any).equipment1 ? {
            1: (prev as any).equipment1 || {},
            2: (prev as any).equipment2 || {},
            3: (prev as any).equipment3 || {},
          } : undefined };
          if (newEquipSets[activeSlot] !== undefined) {
            newEquipSets[activeSlot] = prev.equipment;
          }
          return {
            ...prev,
            equipment: data.equipment,
            equipment1: newEquipSets[1],
            equipment2: newEquipSets[2],
            equipment3: newEquipSets[3],
            activeEquipSlot: slot,
          } as Character;
        });
      }
    } catch {}
  };

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
        equipSets={equipSets}
        activeEquipSlot={activeSlot}
        onSwitchSet={handleSwitchSet}
      />
      <StatAllocation />
      <BuffsBlock room={effectiveRoom} drink={character.drink} premium={character.premium} inventory={character.inventory} equipment={character.equipment} collectionCount={character.collectionCount || 0} totalCollectionItems={character.totalCollectionItems || 189} />
      <AchievementsBlock />
    </div>
  );
}
