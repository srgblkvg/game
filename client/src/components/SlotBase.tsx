import React from 'react';
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
  style?: React.CSSProperties;
  customStyle?: React.CSSProperties;
  title?: string;
  children?: React.ReactNode;
}

export default function SlotBase({
  item, draggable, onClick, onDragStart, onDrop, onDragOver,
  onMouseEnter, onMouseMove, onMouseLeave, onTouchStart, onTouchEnd,
  style, customStyle, title, children,
}: SlotBaseProps) {
  const color = getRarityColor(item);
  const img = getItemImage(item);

  const bgStyle = img
    ? {
        backgroundImage: `url(/${img})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }
    : {
        backgroundColor: item ? color : 'rgba(0,0,0,0.65)',
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
    </div>
  );
}
