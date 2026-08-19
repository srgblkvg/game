import { getItemImage, getRarityColor } from '../../utils/itemUtils';
import { getItemUpgradeLevel } from '../../utils/itemDisplay';

interface EquipmentChoiceItem {
  id: string;
  name?: string;
  image?: string | null;
  rarity_color?: string;
  rarity_id?: number;
  slot?: string;
  type?: string;
  itemType?: string;
  upgradeLevel?: unknown;
  upgradelevel?: unknown;
}

interface EquipmentChoiceRowProps {
  item: EquipmentChoiceItem;
  onSelect: (itemId: string) => void;
}

export default function EquipmentChoiceRow({ item, onSelect }: EquipmentChoiceRowProps) {
  const upgradeLevel = getItemUpgradeLevel(item);
  const image = getItemImage(item);
  const color = getRarityColor(item);

  return (
    <div
      onClick={() => onSelect(item.id)}
      className="flex items-center gap-2 p-2 bg-[var(--color-bg-input)] mb-1 cursor-pointer rounded hover:bg-[var(--color-bg-hover)] text-sm"
    >
      {image ? (
        <div className="w-8 h-8 rounded flex-shrink-0 border-2" style={{ borderColor: color, background: `url(${image}) center / contain no-repeat` }} />
      ) : (
        <div className="w-8 h-8 rounded flex-shrink-0 border-2 flex items-center justify-center text-xs" style={{ borderColor: color, color }}>?</div>
      )}
      <span className="text-[var(--color-text-primary)]">{item.name}</span>
      {upgradeLevel > 0 && (
        <span className="text-[var(--color-text-accent)] text-xs ml-auto">+{upgradeLevel}</span>
      )}
    </div>
  );
}
