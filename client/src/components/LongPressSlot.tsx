// client/src/components/LongPressSlot.tsx
import React from 'react';
import Slot from './Slot';
import { useLongPress } from '../hooks/useLongPress';

interface LongPressSlotProps {
    slotId: string;
    item: any;
    blocked?: boolean;
    highlighted?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onMouseEnter?: () => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
    onLongPress?: (slotId: string, item: any, e: React.TouchEvent | React.MouseEvent) => void;
    style?: React.CSSProperties;
}

export default function LongPressSlot({
    slotId,
    item,
    blocked,
    highlighted,
    onClick,
    onDragOver,
    onDrop,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    onLongPress,
    style,
}: LongPressSlotProps) {
    const longPressHandlers = useLongPress(
        (e) => onLongPress?.(slotId, item, e),
        undefined,
        500
    );

    return (
        <Slot
            slotId={slotId}
            item={item}
            blocked={blocked}
            highlighted={highlighted}
            onClick={onClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onMouseEnter={onMouseEnter}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onTouchStart={longPressHandlers.onTouchStart}
            onTouchEnd={longPressHandlers.onTouchEnd}
            style={style}
        />
    );
}