import React from 'react';
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

export default function ItemSlot({
    item,
    draggable,
    onClick,
    onDragStart,
    onDrop,
    onDragOver,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    highlighted,
    style,
    title,
}: ItemSlotProps) {
    const borderColor = item ? getRarityColor(item.rarity) : (highlighted ? '#2ecc71' : '#555');

    const backgroundStyle = item?.image
        ? {
            backgroundImage: `url(/${item.image})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
        }
        : {
            backgroundColor: item ? getRarityColor(item.rarity) : 'rgba(0,0,0,0.65)',
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
            onContextMenu={(e) => e.preventDefault()}   // ← убирает системное меню
            title={title}
            style={{
                width: '44px',
                height: '44px',
                border: `2px solid ${borderColor}`,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: item ? 'pointer' : 'default',
                position: 'relative',
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 0 2px #000',
                fontSize: '0.65rem',
                boxShadow: highlighted ? '0 0 8px #2ecc71' : 'none',
                ...backgroundStyle,
                ...style,
            }}
        >
            {item && (item.upgradeLevel ?? 0) > 0 && (
                <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: '#f1c40f',
                    color: '#000',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    lineHeight: 1,
                }}>
                    +{item.upgradeLevel}
                </span>
            )}
        </div>
    );
}