// client/src/components/CharacterCard.tsx
import { useState, useEffect } from 'react';
import { useGlobalChat } from '../contexts/ChatContext';
import LongPressSlot from './LongPressSlot';
import { slotNames, slotCategories } from '../utils/itemUtils';
import ItemTooltip from './ItemTooltip';

export interface CharacterCardData {
  username: string;
  level: number;
  exp?: number;
  currentHp?: number;
  maxHp?: number;
  stamina?: number;
  maxStamina?: number;
  equipment: Record<string, any>;
  stats?: { s: number; a: number; d: number; m: number; hp?: number; maxStamina?: number };
  gender?: string;
}

interface CharacterCardProps {
  char: CharacterCardData;
  side?: 'left' | 'right';
  showHealth?: boolean;
  showStamina?: boolean;
  showExp?: boolean;
  readOnly?: boolean;
  onEquip?: (slotId: string, itemId?: string) => void;
  availableItems?: any[];
  selectedItemId?: string | null;
  highlightedSlots?: string[];
  compact?: boolean | 'mobile' | 'verySmall';
}

export default function CharacterCard({
  char,
  side = 'left',
  showHealth = true,
  showStamina = true,
  showExp = true,
  readOnly = false,
  onEquip,
  availableItems,
  selectedItemId,
  highlightedSlots,
  compact = false,
}: CharacterCardProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const { sendItemLink } = useGlobalChat();

  // Закрытие тултипа при любом клике в документе
  useEffect(() => {
    const handleGlobalClick = () => {
      setHoveredSlot(null);
      setTooltipPos(null);
    };
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

  const expPercent = (showExpBar && char.exp !== undefined)
    ? Math.min(100, (char.exp! / expNeeded) * 100)
    : 0;

  const isWeapon2Blocked = char.equipment['weapon1']?.name?.includes('двуручн');

  const maxNickLength = isVerySmall ? 6 : isMobile ? 8 : 12;
  const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

  const cardWidth = isVerySmall ? '110px' : isMobile ? '150px' : '200px';
  const cardMargin = isVerySmall ? '2px' : isMobile ? '10px' : '20px';
  const frameHeight = isVerySmall ? '140px' : isMobile ? '180px' : '240px';
  const fontSizeStats = isVerySmall ? '0.5rem' : isMobile ? '0.65rem' : '0.8rem';
  const fontSizeName = isVerySmall ? '0.65rem' : isMobile ? '0.9rem' : '1.1rem';
  const slotGap = isVerySmall ? '3px' : isMobile ? '6px' : '4px';
  const slotSize = isVerySmall ? '24px' : isMobile ? '36px' : undefined;
  const statsMaxWidth = isVerySmall ? '38px' : isMobile ? '46px' : '60px';
  const statsPadding = isVerySmall ? '0.15rem 0.2rem' : isMobile ? '0.2rem 0.3rem' : '0.4rem 0.6rem';

  const handleDrop = async (slotId: string, e: React.DragEvent) => {
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
    if (e.shiftKey && item) {
      e.stopPropagation();
      sendItemLink(item.id, item);
      return;
    }
    if (selectedItemId && highlightedSlots?.includes(slotId)) {
      onEquip?.(slotId, selectedItemId);
      return;
    }
    if (item) {
      onEquip?.(slotId);
    } else {
      setSelectedSlot(slotId);
    }
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
    const item = char.equipment[slotId];
    if (item) {
      setHoveredSlot(slotId);
    }
  };

  const handleMouseMoveSlot = (e: React.MouseEvent) => {
    if (hoveredSlot) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeaveSlot = () => {
    setHoveredSlot(null);
    setTooltipPos(null);
  };

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

  const cardId = `fighter-${side}`;

  const bgImage = char.gender === 'female'
    ? 'url(/character_woman.webp)'
    : 'url(/character_man.webp)';

  return (
    <div className={`fighter-card ${side} flex-shrink-0`} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: cardWidth,
      minWidth: cardWidth,
      margin: cardMargin, color: '#eee',
    }}>
      <div style={{ width: '100%', textAlign: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: fontSizeName }}>{truncate(char.username)}</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <span style={{ fontSize: isVerySmall ? '0.6rem' : isMobile ? '0.75rem' : '0.85rem' }}>Ур. {char.level}</span>
          {showExpBar && char.exp !== undefined && (
            <div style={{ width: '100px', height: '14px', background: '#222', borderRadius: '4px', overflow: 'hidden', border: '1px solid #555', position: 'relative' }}>
              <div style={{ width: `${expPercent}%`, height: '100%', background: '#9b59b6', transition: 'width 0.3s' }} />
              <span style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#fff', textShadow: '0 0 2px #000' }}>
                {char.exp}/{expNeeded}
              </span>
            </div>
          )}
        </div>
      </div>

      <div id={cardId} style={{
        border: '2px solid #555',
        borderRadius: '12px', padding: '0.8rem', width: '100%',
        background: '#2a2a3e', position: 'relative', height: frameHeight,
      }}>
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: '10px', overflow: 'hidden',
        }}>
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: bgImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: side === 'right' ? 'scaleX(-1)' : 'none',
          zIndex: 0,
        }} />
        </div>

        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.7)',
          padding: statsPadding,
          borderRadius: '8px',
          zIndex: 1,
          color: '#eee',
          fontSize: fontSizeStats,
          lineHeight: '1.2',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', maxWidth: statsMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>Сила</td>
                <td style={{ textAlign: 'right' }}>{stats.s}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', maxWidth: statsMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>Ловкость</td>
                <td style={{ textAlign: 'right' }}>{stats.a}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', maxWidth: statsMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>Защита</td>
                <td style={{ textAlign: 'right' }}>{stats.d}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', maxWidth: statsMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>Мастерство</td>
                <td style={{ textAlign: 'right' }}>{stats.m}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ position: 'absolute', left: '4px', top: '10px', display: 'flex', flexDirection: 'column', gap: slotGap, zIndex: 1 }}>
          {['amulet', 'ring1', 'ring2', 'belt'].map(slotId => (
            <LongPressSlot
              key={slotId}
              slotId={slotId}
              item={char.equipment[slotId]}
              blocked={false}
              highlighted={highlightedSlots?.includes(slotId)}
              onClick={(e) => handleSlotClick(slotId, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(slotId, e)}
              onMouseEnter={() => handleMouseEnterSlot(slotId)}
              onMouseMove={handleMouseMoveSlot}
              onMouseLeave={handleMouseLeaveSlot}
              onLongPress={handleSlotLongPress}
              style={slotSize ? { width: slotSize, height: slotSize, fontSize: '0.55rem' } : undefined}
            />
          ))}
        </div>

        <div style={{ position: 'absolute', right: '4px', top: '10px', display: 'flex', flexDirection: 'column', gap: slotGap, zIndex: 1 }}>
          {['helmet', 'chest', 'gloves', 'boots'].map(slotId => (
            <LongPressSlot
              key={slotId}
              slotId={slotId}
              item={char.equipment[slotId]}
              blocked={false}
              highlighted={highlightedSlots?.includes(slotId)}
              onClick={(e) => handleSlotClick(slotId, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(slotId, e)}
              onMouseEnter={() => handleMouseEnterSlot(slotId)}
              onMouseMove={handleMouseMoveSlot}
              onMouseLeave={handleMouseLeaveSlot}
              onLongPress={handleSlotLongPress}
              style={slotSize ? { width: slotSize, height: slotSize, fontSize: '0.55rem' } : undefined}
            />
          ))}
        </div>

        {/* Оружие */}
        <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: slotGap, zIndex: 1 }}>
          {['weapon1', 'weapon2'].map(slotId => {
            const item = char.equipment[slotId];
            const blocked = slotId === 'weapon2' && isWeapon2Blocked;
            return (
              <LongPressSlot
                key={slotId}
                slotId={slotId}
                item={item}
                blocked={blocked}
                highlighted={highlightedSlots?.includes(slotId)}
                onClick={(e) => !blocked && handleSlotClick(slotId, e)}
                onDragOver={!blocked ? handleDragOver : undefined}
                onDrop={!blocked ? (e) => handleDrop(slotId, e) : undefined}
                onMouseEnter={!blocked ? () => handleMouseEnterSlot(slotId) : undefined}
                onMouseMove={handleMouseMoveSlot}
                onMouseLeave={handleMouseLeaveSlot}
                onLongPress={!blocked ? handleSlotLongPress : undefined}
                style={slotSize ? { width: slotSize, height: slotSize, fontSize: '0.55rem' } : undefined}
              />
            );
          })}
        </div>

        <div className="effect-overlay" id={`effect-${side}`}></div>
      </div>

      {showHealth && char.currentHp !== undefined && (
        <div style={{ width: '100%', marginTop: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: isVerySmall ? '0.55rem' : isMobile ? '0.75rem' : '0.85rem' }}>Здоровье: {char.currentHp}/{hp}</div>
          <div style={{ height: '14px', background: '#333', borderRadius: '4px', overflow: 'hidden', border: '1px solid #555' }}>
            <div style={{ width: `${(char.currentHp / hp) * 100}%`, height: '100%', background: '#e74c3c', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {showStamina && char.stamina !== undefined && (
        <div style={{ width: '100%', marginTop: '0.3rem', textAlign: 'center' }}>
          <div style={{ fontSize: isVerySmall ? '0.5rem' : isMobile ? '0.7rem' : '0.8rem' }}>Вын: {Math.round(char.stamina)}/{char.maxStamina ?? 100}</div>
          <div style={{ height: '5px', background: '#333', borderRadius: '3px', marginTop: '2px' }}>
            <div style={{ width: `${(char.stamina / (char.maxStamina ?? 100)) * 100}%`, height: '100%', background: '#f1c40f', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {hoveredSlot && char.equipment[hoveredSlot] && tooltipPos && (
        <ItemTooltip item={char.equipment[hoveredSlot]} position={tooltipPos} />
      )}

      {!readOnly && selectedSlot && (
        <div style={{ marginTop: '1rem', background: '#1e1e30', padding: '0.5rem', borderRadius: '8px', border: '1px solid #555', width: '100%' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Выберите предмет для {slotNames[selectedSlot]}:</div>
          {getFilteredItems().map((item: any) => (
            <div key={item.id} onClick={() => handleEquipSelect(item.id)}
              style={{ padding: '0.3rem 0.5rem', background: '#333', marginBottom: '0.2rem', cursor: 'pointer', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}>
              {item.name}
            </div>
          ))}
          <button onClick={() => setSelectedSlot(null)} style={{ marginTop: '0.5rem', background: '#555', border: 'none', borderRadius: '4px', color: '#fff', padding: '0.3rem 0.6rem', cursor: 'pointer' }}>Закрыть</button>
        </div>
      )}
    </div>
  );
}