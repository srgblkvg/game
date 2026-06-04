import { getRarityColor, getItemImage, isCraftItem, getItemTypeName } from '../utils/itemUtils';
import type { ReactNode } from 'react';

interface ItemStatsProps {
  item: any;
  showImage?: boolean;
  imageSize?: number;
  extra?: ReactNode;
}

const statNameRu: Record<string, string> = {
  s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство',
  crit: 'Крит', dodge: 'Уклонение', counter: 'Контрудар',
  fullBlock: 'Полный блок', block: 'Блок',
};

export default function ItemStats({ item, showImage = true, imageSize = 48, extra }: ItemStatsProps) {
  if (!item) return null;
  const color = getRarityColor(item);
  const img = getItemImage(item);
  const upgradeLevel = item.upgradeLevel ?? 0;
  const resource = isCraftItem(item);

  const getBonus = (base: number) => {
    if (!base || upgradeLevel === 0) return base;
    return Math.round(base * (1 + upgradeLevel * 0.05));
  };

  const rows: [string, number][] = [];
  if (item.bonuses) {
    for (const [k, v] of Object.entries(item.bonuses)) {
      if ((v as number) > 0) rows.push([statNameRu[k] || k, getBonus(v as number)]);
    }
  }
  if (item.extra) {
    for (const [k, v] of Object.entries(item.extra)) {
      if ((v as number) > 0) rows.push([statNameRu[k] || k, v as number]);
    }
  }

  return (
    <div>
      {/* Имя без рамки, с иконкой */}
      <div className="flex items-center gap-2 mb-2">
        {showImage && (
          <div
            className="flex-shrink-0 rounded flex items-center justify-center font-bold text-white"
            style={{
              width: imageSize, height: imageSize,
              border: `2px solid ${color}`,
              background: img ? `url(${img}) center / contain no-repeat` : color,
              textShadow: '0 0 2px #000',
              fontSize: imageSize < 40 ? '0.6rem' : '0.7rem',
            }}
          >
            {!img && (resource ? '?' : item.name?.substring(0, 2))}
          </div>
        )}
        <div className="font-bold text-sm truncate min-w-0" style={{ color }}>
          {item.name}
          {upgradeLevel > 0 && <span style={{ color: '#f39c12' }}> +{upgradeLevel}</span>}
        </div>
      </div>

      {/* Редкость */}
      <div className="text-xs mb-2 text-center" style={{ color: '#aaa' }}>
        Редкость: {item.rarity_display || 'Обычный'}
      </div>

      {/* Таблица характеристик */}
      {!resource && rows.length > 0 && (
        <div className="text-xs">
          {rows.map(([name, val], i) => (
            <div
              key={i}
              className="flex justify-between py-0.5 px-1"
              style={{
                background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <span>{name}</span>
              <span className="font-bold text-white">+{val}</span>
            </div>
          ))}
        </div>
      )}

      {resource && (
        <div className="text-xs">
          {[
            ['Тип', getItemTypeName(item)],
            ['Количество', String(item.count)],
          ].map(([name, val], i) => (
            <div
              key={i}
              className="flex justify-between py-0.5 px-1"
              style={{
                background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <span>{name}</span>
              <span className="font-bold text-white">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Уровень улучшения */}
      {!resource && upgradeLevel > 0 && (
        <div className="text-xs mt-2 pt-1 border-t border-[var(--color-border-light)] text-center" style={{ color: '#f39c12' }}>
          Улучшение +{upgradeLevel} (+{upgradeLevel * 5}% к характеристикам)
        </div>
      )}

      {extra}
    </div>
  );
}
