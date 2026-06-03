import React from 'react';
import { Icon } from '@iconify/react';
import { getRarityColor, getItemImage } from '../utils/itemUtils';

interface SlotBaseProps {
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
  customStyle?: React.CSSProperties;
  title?: string;
  children?: React.ReactNode;
}

const EQUIPMENT_ICONS: Record<string, string> = {
  'Шлем': 'game-icons:helmet',
  'Нагрудник': 'game-icons:chest-armor',
  'Перчатки': 'game-icons:gloves',
  'Ботинки': 'game-icons:boots',
  'Амулет': 'game-icons:gem-necklace',
  'Кольцо': 'game-icons:ring',
  'Пояс': 'game-icons:belt',
  'Оружие 1': 'game-icons:broadsword',
  'Оружие 2': 'game-icons:shield',
};

export default function SlotBase({
  item, draggable, onClick, onDragStart, onDrop, onDragOver,
  onMouseEnter, onMouseMove, onMouseLeave, onTouchStart, onTouchEnd,
  style, customStyle, title, children,
}: SlotBaseProps) {
  const color = getRarityColor(item);
  const img = getItemImage(item);

  const bgStyle = img
    ? {
        backgroundImage: `url(${img})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }
    : item
    ? {
        backgroundColor: color,
      }
    : {
        backgroundColor: title ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)',
      };

  const baseStyle: React.CSSProperties = {
    width: '44px', height: '44px',
    borderRadius: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    fontWeight: 'bold', color: '#fff',
    textShadow: '0 0 2px #000',
    fontSize: '0.65rem',
    cursor: item ? 'pointer' : 'default',
    ...bgStyle,
    ...style,
    ...customStyle,
  };

  const iconName = title ? EQUIPMENT_ICONS[title] : null;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      title={title}
      style={baseStyle}
    >
      {children}
      {!item && (
        iconName ? (
          <Icon icon={iconName} width="24" height="24" style={{ opacity: 0.5 }} />
        ) : (
          <span style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '0.55rem',
            textAlign: 'center',
            lineHeight: 1.1,
            pointerEvents: 'none',
          }}>Пусто</span>
        )
      )}
    </div>
  );
}
