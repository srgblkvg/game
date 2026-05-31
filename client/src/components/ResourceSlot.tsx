import React from 'react';
import { getRarityColor, getItemImage } from '../utils/itemUtils';

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

export default function ResourceSlot({
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
    style,
}: ResourceSlotProps) {
    const color = getRarityColor(item);
    const img = getItemImage(item);

    const backgroundStyle = img
        ? {
            backgroundImage: `url(/${img})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
        }
        : {
            backgroundColor: color,
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
            style={{
                width: '44px',
                height: '44px',
                border: `2px solid ${color}`,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 0 2px #000',
                fontSize: '0.65rem',
                ...backgroundStyle,
                ...style,
            }}
        >
            <span style={{
                position: 'absolute',
                bottom: 1,
                right: 2,
                fontSize: '0.5rem',
                color: '#fff',
                textShadow: '0 0 2px #000',
            }}>
                {item.count}
            </span>
        </div>
    );
}