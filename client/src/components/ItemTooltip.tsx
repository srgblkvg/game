// client/src/components/ItemTooltip.tsx
import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from './ItemStats';

interface ItemTooltipProps {
  item: any;
  position: { x: number; y: number };
}

const TOOLTIP_MARGIN = 8;   // gap from cursor
const SCREEN_PADDING = 8;    // min distance from viewport edges

const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, position }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0, opacity: 0 });

  const computePosition = useCallback(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    // Start: right of cursor, above cursor
    let left = position.x + TOOLTIP_MARGIN;
    let top = position.y - rect.height - TOOLTIP_MARGIN;

    // If above goes off top edge, put below cursor
    if (top < SCREEN_PADDING) {
      top = position.y + TOOLTIP_MARGIN;
    }

    // If below goes off bottom edge, clamp
    if (top + rect.height > innerHeight - SCREEN_PADDING) {
      top = innerHeight - rect.height - SCREEN_PADDING;
    }

    // If right goes off right edge, flip to left of cursor
    if (left + rect.width > innerWidth - SCREEN_PADDING) {
      left = position.x - rect.width - TOOLTIP_MARGIN;
    }

    // If left goes off left edge, clamp
    if (left < SCREEN_PADDING) {
      left = SCREEN_PADDING;
    }

    // Final clamp for top (in case clamp from bottom pushed it above)
    if (top < SCREEN_PADDING) {
      top = SCREEN_PADDING;
    }

    setAdjustedPos({ left, top, opacity: 1 });
  }, [position, item]);

  // useLayoutEffect — runs synchronously after DOM mutations, before paint
  useLayoutEffect(() => {
    computePosition();
  }, [computePosition]);

  if (!item) return null;

  const color = getRarityColor(item);

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-[#1e1e30] rounded-lg p-[0.7rem] z-[9999] text-[#eee] text-xs max-w-[220px] pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.8)] border border-solid"
      style={{
        left: adjustedPos.left,
        top: adjustedPos.top,
        opacity: adjustedPos.opacity,
        borderColor: color,
        visibility: adjustedPos.opacity ? 'visible' : 'hidden',
      }}
    >
      <ItemStats item={item} imageSize={36} />
    </div>
  );
};

export default ItemTooltip;
