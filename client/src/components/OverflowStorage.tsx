// Склад — предметы и серебро с аукциона
import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import ItemSlot from './ItemSlot';
import ItemTooltip from './ItemTooltip';
import { getHeaders } from '../api/helpers';
import { formatMoney } from '../utils/money';
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
  const [overflowMoney, setOverflowMoney] = useState(0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchMoney();
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

  const fetchMoney = async () => {
    try {
      const r = await fetch('/api/overflow/money', { headers: getHeaders() });
      if (r.ok) { const d = await r.json(); setOverflowMoney(d.overflowmoney || 0); }
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
      try { const ch = await fetchCharacter(); setCharacter(ch); } catch {}
      onTake?.();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const withdrawAllMoney = async () => {
    if (overflowMoney <= 0) return;
    setError(''); setMsg('');
    try {
      const r = await fetch('/api/overflow/money/withdraw', {
        method: 'POST', headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: overflowMoney }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); return; }
      setOverflowMoney(d.remaining);
      setMsg(`Выведено ${formatMoney(d.withdrawn)}`);
      setTimeout(() => setMsg(''), 3000);
      setCharacter((prev: any) => ({ ...prev, money: (prev.money || 0) + d.withdrawn }));
    } catch (e: any) { setError(e.message); }
  };

  const hasContent = items.length > 0 || overflowMoney > 0;
  if (!hasContent) return null;

  return (
    <div className="mt-4 w-full max-w-2xl mx-auto bg-[var(--color-bg-secondary)] rounded-xl p-4 border-2 border-[var(--color-border-light)] text-[var(--color-text-primary)]">
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{expanded ? '▼' : '▶'}</span>
          <Icon icon="game-icons:locked-chest" width="18" height="18" className="text-[var(--color-accent-gold)]" />
          <h3 className="font-bold text-sm">
            Склад{items.length > 0 && ` (${items.length})`}
            {overflowMoney > 0 && <span className="text-[var(--color-accent-gold)] ml-2">💰 {formatMoney(overflowMoney)}</span>}
          </h3>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">Нельзя ограбить</span>
      </div>

      {expanded && (
        <div className="mt-3">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Предметы и серебро с аукциона. Защищены от кражи в PvP.
          </p>

          {/* Вывод серебра */}
          {overflowMoney > 0 && (
            <div className="mb-3 p-2 bg-[var(--color-bg-input)] rounded flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--color-accent-gold)] font-bold">{formatMoney(overflowMoney)}</span>
              <button
                className="px-2 py-1 text-xs rounded bg-[var(--color-accent-gold)] text-black font-bold hover:opacity-90 cursor-pointer"
                onClick={withdrawAllMoney}
              >Забрать всё</button>
              {msg && <span className="text-xs text-[var(--color-accent-success)]">{msg}</span>}
            </div>
          )}

          {error && <p className="text-xs text-[var(--color-accent-danger)] mb-2">{error}</p>}
          {items.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,48px)] gap-2">
              {items.map((oi) => (
                <OverflowItemSlot key={oi.id} oi={oi} onTake={takeItem} loading={loading} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
