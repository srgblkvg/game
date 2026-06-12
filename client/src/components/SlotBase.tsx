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
  'Оружие': 'game-icons:broadsword',
  'Щит': 'game-icons:shield',
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
        backgroundColor: title ? 'var(--color-bg-input)' : 'var(--color-bg-input)',
      };

  const slotClassName = `w-[44px] h-[44px] rounded flex items-center justify-center relative font-bold text-[var(--color-text-muted)] text-[0.65rem] ${item ? 'cursor-pointer' : 'cursor-default'}`;
  const slotStyle: React.CSSProperties = {
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
      className={slotClassName}
      style={slotStyle}
    >
      {children}
      {!item && (
        iconName ? (
          <Icon icon={iconName} width="24" height="24" className="opacity-50" />
        ) : (
          <span className="text-[var(--color-text-muted)] text-[0.55rem] text-center leading-[1.1] pointer-events-none">Пусто</span>
        )
      )}
    </div>
  );
}
