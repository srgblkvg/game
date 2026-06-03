// client/src/components/CharacterCard.tsx
import { useState, useEffect } from 'react';
import { useGlobalChat } from '../contexts/ChatContext';
import { slotNames, slotCategories } from '../utils/itemUtils';
import ItemTooltip from './ItemTooltip';
import HealthBar from './CharacterCard/HealthBar';
import EquipmentSlots from './CharacterCard/EquipmentSlots';
import StatsOverlay from './CharacterCard/StatsOverlay';
import type { CharacterCardData } from '../types/character';

interface CharacterCardProps {
  char: CharacterCardData;
  side?: 'left' | 'right';
  showHealth?: boolean;
  showExp?: boolean;
  showRegenHint?: boolean;
  readOnly?: boolean;
  onEquip?: (slotId: string, itemId?: string) => void;
  availableItems?: any[];
  selectedItemId?: string | null;
  highlightedSlots?: string[];
  compact?: boolean | 'mobile' | 'verySmall';
  isMob?: boolean;
}

export default function CharacterCard({
  char, side = 'left', showHealth = true,
  showExp = true, showRegenHint = true, readOnly = false,
  onEquip, availableItems, selectedItemId, highlightedSlots,
  compact = false, isMob = false,
}: CharacterCardProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const { sendItemLink } = useGlobalChat();

  useEffect(() => {
    const handleGlobalClick = () => { setHoveredSlot(null); setTooltipPos(null); };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  if (!char) return null;

  const stats = char.stats || { s: 0, a: 0, d: 0, m: 0 };
  const hp = char.maxHp ?? stats.hp ?? (stats.s + stats.a + stats.d + stats.m);
  const expNeeded = 10 * Math.pow(2, char.level - 1);

  const isMobile = compact === 'mobile' || compact === 'verySmall';
  const isVerySmall = compact === 'verySmall';
  const showExpBar = showExp && !isMobile && char.exp !== undefined;
  const expPercent = showExpBar ? Math.min(100, (char.exp! / expNeeded) * 100) : 0;
  const isWeapon2Blocked = char.equipment['weapon1']?.name?.includes('двуручн');

  const maxNickLength = isVerySmall ? 6 : isMobile ? 8 : 12;
  const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

  const cardWidth = isVerySmall ? '110px' : isMobile ? '150px' : '200px';
  const cardMargin = isVerySmall ? '2px' : isMobile ? '10px' : '20px';
  const frameHeight = isVerySmall ? '140px' : isMobile ? '180px' : '240px';
  const fontSizeName = isVerySmall ? '0.65rem' : isMobile ? '0.9rem' : '1.1rem';
  const slotGap = isVerySmall ? '2px' : isMobile ? '4px' : '4px';
  const slotSize = isVerySmall ? '20px' : isMobile ? '26px' : undefined;

  const cardId = `fighter-${side}`;
  const bgImage = isMob
    ? 'none'
    : (char.gender === 'female'
      ? 'url(/character_woman.webp)'
      : 'url(/character_man.webp)');

  // --- Handlers ---
  const handleDrop = (slotId: string, e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (itemId) onEquip?.(slotId, itemId);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleSlotClick = (slotId: string, e: React.MouseEvent) => {
    if (readOnly) return;
    const item = char.equipment[slotId];
    if (e.shiftKey && item) { e.stopPropagation(); sendItemLink(item.id, item); return; }
    if (selectedItemId && highlightedSlots?.includes(slotId)) { onEquip?.(slotId, selectedItemId); return; }
    if (item) { onEquip?.(slotId); } else { setSelectedSlot(slotId); }
  };
  const handleEquipSelect = (itemId: string) => {
    if (!selectedSlot) return;
    onEquip?.(selectedSlot, itemId);
    setSelectedSlot(null);
  };
  const handleSlotLongPress = (slotId: string, item: any, e: React.TouchEvent | React.MouseEvent) => {
    if (item) {
      const touch = (e as React.TouchEvent).touches?.[0] ?? e;
      setTooltipPos({ x: touch.clientX, y: touch.clientY });
      setHoveredSlot(slotId);
    }
  };
  const handleMouseEnterSlot = (slotId: string) => {
    if (char.equipment[slotId]) setHoveredSlot(slotId);
  };
  const handleMouseMoveSlot = (e: React.MouseEvent) => {
    if (hoveredSlot) setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseLeaveSlot = () => { setHoveredSlot(null); setTooltipPos(null); };
  const getFilteredItems = () => {
    if (!availableItems || !selectedSlot) return [];
    const cat = slotCategories[selectedSlot];
    return availableItems.filter((item: any) => {
      if (item.type === 'material' || item.type === 'craft_item') return false;
      if (cat === 'ring') return item.slot === 'ring1' || item.slot === 'ring2';
      if (cat === 'weapon') return item.slot === 'weapon1' || item.slot === 'weapon2';
      return item.slot === selectedSlot;
    });
  };

  // --- Render ---
  return (
    <div className={`fighter-card ${side} flex-shrink-0`} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: cardWidth, minWidth: cardWidth, margin: cardMargin, color: '#eee',
    }}>
      {/* Имя и уровень */}
      <div style={{ width: '100%', textAlign: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: fontSizeName }}>{truncate(char.username)}</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span style={{ fontSize: isVerySmall ? '0.65rem' : isMobile ? '0.75rem' : '0.85rem' }}>Ур. {char.level}</span>
          {showExpBar && (
            <div style={{ width: '100px', height: '14px', background: '#222', borderRadius: '4px', overflow: 'hidden', border: '1px solid #555', position: 'relative' }}>
              <div style={{ width: `${expPercent}%`, height: '100%', background: '#9b59b6', transition: 'width 0.3s' }} />
              <span className="absolute inset-0 flex items-center justify-center text-white text-[0.55rem]" style={{ textShadow: '0 0 2px #000' }}>
                {char.exp}/{expNeeded}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Фрейм с фоном и слотами */}
      <div id={cardId} style={{
        border: '2px solid #555', borderRadius: '12px', padding: '0.8rem',
        width: '100%', background: '#2a2a3e', position: 'relative', height: frameHeight,
      }}>
        <div className="absolute inset-0 overflow-hidden rounded-[10px]">
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: bgImage, backgroundSize: 'cover', backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            transform: side === 'right' ? 'scaleX(-1)' : 'none',
            zIndex: 0,
          }} />
        </div>

        <StatsOverlay stats={stats} compact={compact} />

        {!isMob && (
        <EquipmentSlots
          equipment={char.equipment}
          side={side}
          highlightedSlots={highlightedSlots}
          isWeapon2Blocked={isWeapon2Blocked}
          slotGap={slotGap}
          slotSize={slotSize ? `${slotSize}` : undefined}
          onSlotClick={handleSlotClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseEnter={handleMouseEnterSlot}
          onMouseMove={handleMouseMoveSlot}
          onMouseLeave={handleMouseLeaveSlot}
          onLongPress={handleSlotLongPress}
        />
        )}

        <div className="effect-overlay" id={`effect-${side}`}></div>
      </div>

      {/* Здоровье */}
      {showHealth && char.currentHp !== undefined && (
        <HealthBar currentHp={char.currentHp} maxHp={hp} compact={compact} showRegenHint={showRegenHint} />
      )}

      {/* Тултип */}
      {hoveredSlot && char.equipment[hoveredSlot] && tooltipPos && (
        <ItemTooltip item={char.equipment[hoveredSlot]} position={tooltipPos} />
      )}

      {/* Выбор предмета для слота */}
      {!readOnly && selectedSlot && (
        <div style={{ marginTop: '1rem', background: '#1e1e30', padding: '0.5rem', borderRadius: '8px', border: '1px solid #555', width: '100%' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Выберите предмет для {slotNames[selectedSlot]}:</div>
          {getFilteredItems().map((item: any) => (
            <div key={item.id} onClick={() => handleEquipSelect(item.id)}
              className="p-1.5 bg-[#333] mb-0.5 cursor-pointer rounded text-white text-xs">
              {item.name}
            </div>
          ))}
          <button onClick={() => setSelectedSlot(null)}
            className="mt-2 bg-[#555] border-none rounded text-white px-2 py-1 cursor-pointer text-xs">
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}
