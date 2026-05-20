import React from 'react';
import ItemSlot from './ItemSlot';
import { slotNames } from '../utils/itemUtils';

interface SlotProps {
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
    onTouchStart?: (e: React.TouchEvent) => void;
    onTouchEnd?: (e: React.TouchEvent) => void;
    style?: React.CSSProperties;
}

export default function Slot({ slotId, item, blocked, highlighted, onClick, onDragOver, onDrop, onMouseEnter, onMouseMove, onMouseLeave, onTouchStart, onTouchEnd, style }: SlotProps) {
    return (
        <ItemSlot
            item={item}
            draggable={!!item && !blocked}
            highlighted={highlighted}
            onClick={onClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onMouseEnter={onMouseEnter}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            title={slotNames[slotId]}
            style={{
                opacity: blocked ? 0.5 : 1,
                cursor: blocked ? 'not-allowed' : 'pointer',
                ...style,
            }}
        />
    );
}