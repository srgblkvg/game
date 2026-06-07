import LongPressSlot from '../LongPressSlot';

interface EquipmentSlotsProps {
  equipment: Record<string, any>;
  side: 'left' | 'right';
  highlightedSlots?: string[];
  isWeapon2Blocked: boolean;
  slotGap: string;
  slotSize?: string;
  onSlotClick: (slotId: string, e: React.MouseEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (slotId: string, e: React.DragEvent) => void;
  onMouseEnter: (slotId: string) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onLongPress: (slotId: string, item: any, e: React.TouchEvent | React.MouseEvent) => void;
}

const LEFT_SLOTS = ['amulet', 'ring1', 'ring2', 'belt'];
const RIGHT_SLOTS = ['helmet', 'chest', 'gloves', 'boots'];
const WEAPON_SLOTS = ['weapon1', 'shield'];

export default function EquipmentSlots(props: EquipmentSlotsProps) {
  const slotStyle = props.slotSize
    ? { width: props.slotSize, height: props.slotSize, fontSize: '0.55rem' }
    : undefined;

  const renderSlot = (slotId: string, blocked = false) => (
    <LongPressSlot
      key={slotId}
      slotId={slotId}
      item={props.equipment[slotId]}
      blocked={blocked}
      highlighted={props.highlightedSlots?.includes(slotId)}
      onClick={(e) => !blocked && props.onSlotClick(slotId, e)}
      onDragOver={!blocked ? props.onDragOver : undefined}
      onDrop={!blocked ? (e) => props.onDrop(slotId, e) : undefined}
      onMouseEnter={!blocked ? () => props.onMouseEnter(slotId) : undefined}
      onMouseMove={props.onMouseMove}
      onMouseLeave={props.onMouseLeave}
      onLongPress={!blocked ? props.onLongPress : undefined}
      style={slotStyle}
    />
  );

  return (
    <>
      {/* Левая колонка */}
      <div style={{ gap: props.slotGap }} className="absolute left-1 top-2.5 flex flex-col z-[1]">
        {LEFT_SLOTS.map(slotId => renderSlot(slotId))}
      </div>

      {/* Правая колонка */}
      <div style={{ gap: props.slotGap }} className="absolute right-1 top-2.5 flex flex-col z-[1]">
        {RIGHT_SLOTS.map(slotId => renderSlot(slotId))}
      </div>

      {/* Оружие (снизу по центру) */}
      <div style={{ gap: props.slotGap }} className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex z-[1]">
        {WEAPON_SLOTS.map(slotId =>
          renderSlot(slotId, slotId === 'shield' && props.isWeapon2Blocked)
        )}
      </div>
    </>
  );
}
