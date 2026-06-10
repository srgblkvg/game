// client/src/components/ItemTooltip.tsx
import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from './ItemStats';

interface ItemTooltipProps {
  item: any;
  position: { x: number; y: number };
}

const TOOLTIP_MARGIN = 8;
const SCREEN_PADDING = 8;

const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, position }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0, opacity: 0 });

  const computePosition = useCallback(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = position.x + TOOLTIP_MARGIN;
    let top = position.y - rect.height - TOOLTIP_MARGIN;

    if (top < SCREEN_PADDING) {
      top = position.y + TOOLTIP_MARGIN;
    }
    if (top + rect.height > vh - SCREEN_PADDING) {
      top = vh - rect.height - SCREEN_PADDING;
    }
    if (left + rect.width > vw - SCREEN_PADDING) {
      left = position.x - rect.width - TOOLTIP_MARGIN;
    }
    if (left < SCREEN_PADDING) {
      left = SCREEN_PADDING;
    }
    if (top < SCREEN_PADDING) {
      top = SCREEN_PADDING;
    }

    setAdjustedPos({ left, top, opacity: 1 });
  }, [position, item]);

  useLayoutEffect(() => {
    computePosition();
  }, [computePosition]);

  if (!item) return null;

  const color = getRarityColor(item);

  const tooltip = (
    <div
      ref={tooltipRef}
      className="fixed bg-[var(--color-bg-secondary)] rounded-lg p-[0.7rem] z-[99999] text-[var(--color-text-primary)] text-xs max-w-[220px] pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.8)] border border-solid"
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

  // Portal to document.body — bypasses any CSS containing blocks (backdrop-filter, transform, etc.)
  return createPortal(tooltip, document.body);
};

export default ItemTooltip;
