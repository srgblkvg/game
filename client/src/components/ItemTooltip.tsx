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
      style={{
        position: 'fixed',
        left: adjustedPos.left,
        top: adjustedPos.top,
        background: '#1e1e30',
        border: `1px solid ${color}`,
        borderRadius: '8px',
        padding: '0.7rem',
        zIndex: 9999,
        color: '#eee',
        fontSize: '0.8rem',
        maxWidth: '220px',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
        opacity: adjustedPos.opacity,
        transition: 'opacity 0.15s',
      }}
    >
      <ItemStats item={item} imageSize={36} />
    </div>
  );
};

export default ItemTooltip;
