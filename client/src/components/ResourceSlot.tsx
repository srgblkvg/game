import React from 'react';
import SlotBase from './SlotBase';
import { getRarityColor } from '../utils/itemUtils';

interface ResourceSlotProps {
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
  style?: React.CSSProperties;
}

export default function ResourceSlot(props: ResourceSlotProps) {
  const { item, style, ...rest } = props;
  const color = getRarityColor(item);

  return (
    <SlotBase
      item={item}
      {...rest}
      customStyle={{
        border: `2px solid ${color}`,
        ...style,
      }}
    >
      <span style={{
        position: 'absolute', bottom: 1, right: 2,
        fontSize: '0.5rem', color: '#fff',
        textShadow: '0 0 2px #000',
      }}>
        {item.count}
      </span>
    </SlotBase>
  );
}
