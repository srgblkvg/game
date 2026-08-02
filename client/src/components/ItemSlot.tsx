import React from 'react';
import SlotBase from './SlotBase';
import { getRarityColor } from '../utils/itemUtils';
import { useGame } from '../contexts/GameContext';

interface ItemSlotProps {
  item: any;
  draggable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  highlighted?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export default function ItemSlot(props: ItemSlotProps) {
  const { item, highlighted, style, title, ...rest } = props;
  const itemColor = getRarityColor(item);
  const borderColor = item ? itemColor : (highlighted ? 'var(--color-accent-success)' : 'var(--color-border-light)');

  // Проверка коллекции
  let collBadge: string | null = null;
  if (item && item.name && item.slot) {
    try {
      const { character } = useGame();
      if (character?.collectedItems) {
        let basic = false, plus = false;
        for (const c of (character.collectedItems as any[])) {
          if (c.itemName === item.name && c.slot === item.slot && (c.rarity_id ?? c.rarity_Id) === item.rarity_id) {
            const lvl = c.upgradelevel ?? 0;
            if (lvl < 7) basic = true;
            if (lvl >= 7) plus = true;
          }
        }
        if (basic && plus) collBadge = 'Б7';
        else if (basic) collBadge = 'Б';
        else if (plus) collBadge = '7';
      }
    } catch {}
  }

  return (
    <SlotBase
      item={item}
      {...rest}
      title={title}
      customStyle={{
        border: `2px solid ${borderColor}`,
        boxShadow: highlighted ? '0 0 8px var(--color-accent-success)' : 'none',
        ...style,
      }}
    >
      {item && (item.upgradeLevel ?? 0) > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--color-text-accent)', color: '#000',
          borderRadius: '50%', width: '16px', height: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 'bold', lineHeight: 1,
        }}>
          +{item.upgradeLevel}
        </span>
      )}
      {collBadge && (
        <span style={{
          position: 'absolute', top: -4, left: -4,
          background: 'var(--color-accent-gold)', color: '#000',
          borderRadius: '50%', width: '16px', height: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', fontWeight: 'bold', lineHeight: 1,
        }}>
          {collBadge}
        </span>
      )}
    </SlotBase>
  );
}
