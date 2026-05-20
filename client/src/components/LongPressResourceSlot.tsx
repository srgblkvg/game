import React from 'react';
import ResourceSlot from './ResourceSlot';
import { useLongPress } from '../hooks/useLongPress';

interface LongPressResourceSlotProps {
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
    style?: React.CSSProperties;
}

export default function LongPressResourceSlot({
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
    style,
}: LongPressResourceSlotProps) {
    const longPressHandlers = useLongPress(
        (e) => onLongPress?.(item, e),
        undefined,
        500
    );

    return (
        <ResourceSlot
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
            style={style}
        />
    );
}