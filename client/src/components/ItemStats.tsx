import { getRarityColor, getItemImage, isCraftItem, getItemTypeName } from '../utils/itemUtils';
import { useGame } from '../contexts/GameContext';
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

  // Проверка коллекции
  let inCollection = false;
  try {
    const { character } = useGame();
    if (character?.collectedItems && item.name && item.slot) {
      inCollection = character.collectedItems.some(
        (c: any) => c.itemName === item.name && c.slot === item.slot
      );
    }
  } catch {}

  const getBonus = (base: number) => {
    if (!base || upgradeLevel === 0) return base;
    return Math.round(base * (1 + upgradeLevel * 0.1));
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
        <div className="font-bold text-xs leading-tight break-words min-w-0" style={{ color }}>
          {item.name}
          {upgradeLevel > 0 && <span className="text-[var(--color-text-accent)]"> +{upgradeLevel}</span>}
        </div>
      </div>

      {/* Редкость */}
      <div className="text-xs mb-2 text-center text-[var(--color-text-muted)]">
        Редкость: {item.rarity_display || 'Обычный'}
      </div>

      {/* Таблица характеристик */}
      {!resource && rows.length > 0 && (
        <div className="text-xs">
          {rows.map(([name, val], i) => (
            <div
              key={i}
              className="flex justify-between py-0.5 px-1"
              style={i % 2 === 0 ? { background: 'var(--color-bg-hover)' } : undefined}
            >
              <span>{name}</span>
              <span className="font-bold text-[var(--color-text-primary)]">+{val}</span>
            </div>
          ))}
        </div>
      )}

      {resource && (
        <div className="text-xs">
          {[
            ['Тип', getItemTypeName(item)],
            ...(item.count != null ? [['Количество', String(item.count)]] : []),
          ].map(([name, val], i) => (
            <div
              key={i}
              className="flex justify-between py-0.5 px-1"
              style={i % 2 === 0 ? { background: 'var(--color-bg-hover)' } : undefined}
            >
              <span>{name}</span>
              <span className="font-bold text-[var(--color-text-primary)]">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Уровень улучшения */}
      {!resource && upgradeLevel > 0 && (
        <div className="text-xs mt-2 pt-1 border-t border-[var(--color-border-light)] text-center text-[var(--color-text-accent)]">
          Улучшение +{upgradeLevel} (+{upgradeLevel * 10}% к характеристикам)
        </div>
      )}

      {/* Set bonuses */}
      {!resource && item.extra?.set && (
        <div className="text-xs mt-2 pt-1 border-t border-[var(--color-border-light)]">
          <div className="text-center font-bold text-[var(--color-accent-purple)]">Сет: {item.extra.set}</div>
          {item.extra.setBonus2 && <div className="text-[var(--color-text-muted)] mt-0.5">2 предмета: {item.extra.setBonus2}</div>}
          {item.extra.setBonus3 && <div className="text-[var(--color-text-muted)]">3 предмета: {item.extra.setBonus3}</div>}
          {item.extra.setBonus4 && <div className="text-[var(--color-text-muted)]">4 предмета: {item.extra.setBonus4}</div>}
        </div>
      )}

      {/* Artifact effect */}
      {!resource && item.extra?.effect && (
        <div className="text-xs mt-2 pt-1 border-t border-[var(--color-border-light)] text-center">
          <span className="font-bold text-[var(--color-accent-gold)]">Артефакт</span>
          <div className="text-[var(--color-text-accent)]">{item.extra.effectDesc || item.extra.effect}</div>
        </div>
      )}

      {/* Коллекция */}
      {!resource && item.name && item.slot && (
        <div className={`text-xs mt-1 pt-1 border-t border-[var(--color-border-light)] text-center font-bold ${inCollection ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-warning)]'}`}>
          {inCollection ? '✓ В коллекции' : '✗ Нет в коллекции'}
        </div>
      )}

      {extra}
    </div>
  );
}
