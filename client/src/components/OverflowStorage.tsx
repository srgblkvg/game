// Склад переполнения — предметы с аукциона, не влезшие в инвентарь
import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import ItemSlot from './ItemSlot';
import ItemTooltip from './ItemTooltip';
import { getHeaders } from '../api/helpers';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api';

interface OverflowItem {
  id: number;
  item: any;
  auctionLotId: number | null;
  createdAt: number;
}

function OverflowItemSlot({ oi, onTake, loading }: { oi: OverflowItem; onTake: (id: number) => void; loading: boolean }) {
  const [tooltip, setTooltip] = useState<{ item: any; x: number; y: number } | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', `overflow:${oi.id}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <div
        className={`cursor-pointer transition-opacity ${loading ? 'opacity-50' : 'hover:opacity-80'}`}
        onClick={() => !loading && onTake(oi.id)}
        onMouseEnter={(e) => setTooltip({ item: oi.item, x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => tooltip && setTooltip({ ...tooltip, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip(null)}
        draggable
        onDragStart={handleDragStart}
        title="Клик — забрать. Перетащить — в инвентарь"
      >
        <ItemSlot item={oi.item} />
      </div>
      {tooltip && <ItemTooltip item={tooltip.item} position={{ x: tooltip.x, y: tooltip.y }} />}
    </>
  );
}

export default function OverflowStorage({ onTake }: { onTake?: () => void }) {
  const { setCharacter } = useGame();
  const [items, setItems] = useState<OverflowItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchItems();
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail;
      setItems(prev => prev.filter(i => i.id !== id));
    };
    window.addEventListener('overflow-taken', handler);
    return () => window.removeEventListener('overflow-taken', handler);
  }, []);

  const fetchItems = async () => {
    try {
      const r = await fetch('/api/overflow', { headers: getHeaders() });
      if (r.ok) setItems(await r.json());
    } catch {}
  };

  const takeItem = async (overflowId: number) => {
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`/api/overflow/take/${overflowId}`, { method: 'POST', headers: getHeaders() });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Ошибка'); return; }
      setItems(prev => prev.filter(i => i.id !== overflowId));
      // Обновляем персонажа чтобы инвентарь появился сразу
      try { const ch = await fetchCharacter(); setCharacter(ch); } catch {}
      onTake?.();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-4 w-full max-w-2xl mx-auto bg-[var(--color-bg-secondary)] rounded-xl p-4 border-2 border-[var(--color-border-light)] text-[var(--color-text-primary)]">
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{expanded ? '▼' : '▶'}</span>
          <Icon icon="game-icons:locked-chest" width="18" height="18" className="text-[var(--color-accent-gold)]" />
          <h3 className="font-bold text-sm">Склад ({items.length})</h3>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">Предметы с аукциона</span>
      </div>

      {expanded && (
        <div className="mt-3">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Предметы, не поместившиеся в инвентарь при выкупе с аукциона. Нажмите — забрать.
          </p>
          {error && <p className="text-xs text-[var(--color-accent-danger)] mb-2">{error}</p>}
          <div className="grid grid-cols-[repeat(auto-fill,48px)] gap-2">
            {items.map((oi) => (
              <OverflowItemSlot key={oi.id} oi={oi} onTake={takeItem} loading={loading} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
