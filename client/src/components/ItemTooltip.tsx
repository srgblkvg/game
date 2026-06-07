// client/src/components/ItemTooltip.tsx
import React, { useRef, useEffect, useState } from 'react';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from './ItemStats';

interface ItemTooltipProps {
  item: any;
  position: { x: number; y: number };
}

const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, position }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0, opacity: 0 });

  useEffect(() => {
    if (!tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;
    let left = position.x + 10;
    let top = position.y - rect.height - 5;

    if (top < 0) top = position.y + 20;
    if (top + rect.height > innerHeight) top = innerHeight - rect.height - 5;
    if (left + rect.width > innerWidth) left = position.x - rect.width - 10;
    if (left < 0) left = 5;
    if (top < 0) top = 5;

    setAdjustedPos({ left, top, opacity: 1 });
  }, [position]);

  if (!item) return null;

  const color = getRarityColor(item);

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-[#1e1e30] rounded-lg p-[0.7rem] z-[9999] text-[#eee] text-xs max-w-[220px] pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-opacity duration-150 border border-solid"
      style={{ left: adjustedPos.left, top: adjustedPos.top, opacity: adjustedPos.opacity, borderColor: color }}
    >
      <ItemStats item={item} imageSize={36} />
    </div>
  );
};

export default ItemTooltip;
