// client/src/components/LongPressItemSlot.tsx
import React from 'react';
import ItemSlot from './ItemSlot';
import { useLongPress } from '../hooks/useLongPress';

interface LongPressItemSlotProps {
    item: any;
    onClick?: (e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
    onLongPress?: (item: any, e: React.TouchEvent | React.MouseEvent) => void;
    draggable?: boolean;
    highlighted?: boolean;
    style?: React.CSSProperties;
    title?: string;
}

export default function LongPressItemSlot({
    item,
    onClick,
    onDragStart,
    onDrop,
    onDragOver,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    onLongPress,
    draggable,
    highlighted,
    style,
    title,
}: LongPressItemSlotProps) {
    const longPressHandlers = useLongPress(
        (e) => onLongPress?.(item, e),
        undefined,
        500
    );

    return (
        <ItemSlot
            item={item}
            draggable={draggable}
            onClick={onClick}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onMouseEnter={onMouseEnter}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onTouchStart={longPressHandlers.onTouchStart}
            onTouchEnd={longPressHandlers.onTouchEnd}
            highlighted={highlighted}
            style={style}
            title={title}
        />
    );
}