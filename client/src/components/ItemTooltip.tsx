// client/src/components/ItemTooltip.tsx
import React, { useRef, useEffect, useState } from 'react';
import { getRarityColor, isCraftItem } from '../utils/itemUtils';

interface ItemTooltipProps {
  item: any;
  position: { x: number; y: number };
}

const rarityNames = ['Серый', 'Белый', 'Зелёный', 'Синий', 'Фиолетовый', 'Жёлтый', 'Красный'];

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
  const color = getRarityColor(item.rarity || 0);
  const isResource = isCraftItem(item);
  const upgradeLevel = item.upgradeLevel ?? 0;

  const getUpgradedBonus = (base: number) => {
    if (!base || upgradeLevel === 0) return base;
    const increase = 1 + upgradeLevel * 0.05;
    return Math.round(base * increase);
  };

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
        padding: '0.8rem',
        zIndex: 9999,
        color: '#eee',
        fontSize: '0.8rem',
        maxWidth: '260px',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
        textAlign: 'left',
        opacity: adjustedPos.opacity,
        transition: 'opacity 0.15s',
        display: 'flex',
        gap: '0.5rem',
      }}
    >
      {/* Миниатюра */}
      <div style={{
        width: '32px',
        height: '32px',
        border: `1px solid ${color}`,
        borderRadius: '4px',
        background: item.image
          ? `url(/${item.image}) center / contain no-repeat`
          : color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6rem',
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '0 0 2px #000',
        flexShrink: 0,
      }}>
        {!item.image && (isResource ? item.rarity + '★' : item.name.substring(0, 2))}
      </div>

      {/* Текстовая часть */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', color, marginBottom: '0.3rem' }}>
          {item.name}
          {upgradeLevel > 0 && ` +${upgradeLevel}`}
        </div>
        {isResource ? (
          <>
            <div>Количество: {item.count}</div>
            <div>Тип: {item.itemType || 'craft'}</div>
          </>
        ) : (
          <>
            <div>Редкость: {rarityNames[item.rarity]}</div>
            {item.bonuses && (item.bonuses.s || item.bonuses.a || item.bonuses.d || item.bonuses.m) ? (
              <div style={{ marginTop: '0.3rem' }}>
                {item.bonuses.s ? <div>Сила +{getUpgradedBonus(item.bonuses.s)}</div> : null}
                {item.bonuses.a ? <div>Ловкость +{getUpgradedBonus(item.bonuses.a)}</div> : null}
                {item.bonuses.d ? <div>Защита +{getUpgradedBonus(item.bonuses.d)}</div> : null}
                {item.bonuses.m ? <div>Мастерство +{getUpgradedBonus(item.bonuses.m)}</div> : null}
              </div>
            ) : null}
            {item.extra && (item.extra.stamReg || item.extra.crit || item.extra.dodge || item.extra.counter || item.extra.fullBlock || item.extra.hpRegen) ? (
              <div style={{ marginTop: '0.3rem' }}>
                {item.extra.stamReg ? <div>Реген вын. +{item.extra.stamReg}</div> : null}
                {item.extra.crit ? <div>Крит +{item.extra.crit}%</div> : null}
                {item.extra.dodge ? <div>Уклонение +{item.extra.dodge}%</div> : null}
                {item.extra.counter ? <div>Контрудар +{item.extra.counter}%</div> : null}
                {item.extra.fullBlock ? <div>Полный блок +{item.extra.fullBlock}%</div> : null}
                {item.extra.hpRegen ? <div>Реген HP +{item.extra.hpRegen}</div> : null}
              </div>
            ) : null}
            {(item.slot?.startsWith('weapon')) && (
              <div style={{ marginTop: '0.3rem' }}>Стоимость атаки: {12 + (item.rarity || 0) * 6} вын.</div>
            )}
            {upgradeLevel > 0 && (
              <div style={{ marginTop: '0.3rem', color: '#f1c40f' }}>Улучшение: +{upgradeLevel * 5}% к характеристикам</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ItemTooltip;