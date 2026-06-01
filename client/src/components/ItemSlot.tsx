import React from 'react';
import SlotBase from './SlotBase';
import { getRarityColor } from '../utils/itemUtils';

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
  const borderColor = item ? itemColor : (highlighted ? '#2ecc71' : '#555');

  return (
    <SlotBase
      item={item}
      {...rest}
      title={title}
      customStyle={{
        border: `2px solid ${borderColor}`,
        boxShadow: highlighted ? '0 0 8px #2ecc71' : 'none',
        ...style,
      }}
    >
      {item && (item.upgradeLevel ?? 0) > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: '#f1c40f', color: '#000',
          borderRadius: '50%', width: '16px', height: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 'bold', lineHeight: 1,
        }}>
          +{item.upgradeLevel}
        </span>
      )}
    </SlotBase>
  );
}
