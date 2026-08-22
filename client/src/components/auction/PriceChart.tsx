import { useCallback, useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { fetchAuctionPriceHistory, type AuctionPricePoint } from '../../api/auction';
import type { GameItem } from '../../types/items';
import { formatMoney } from '../../utils/money';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export default function PriceChart({ item }: { item: GameItem }) {
  const [points, setPoints] = useState<AuctionPricePoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const itemKey = `${item.name}|${item.slot || ''}|${item.rarity_id ?? 0}|${item.upgradeLevel ?? 0}`;

  useEffect(() => {
    setPoints(null);
    setLoading(false);
    setError('');
  }, [itemKey]);

  const fetchHistory = useCallback(async () => {
    if (points !== null) return;
    setLoading(true);
    setError('');
    try {
      setPoints(await fetchAuctionPriceHistory(item));
    } catch {
      setError('Не удалось загрузить историю');
    } finally {
      setLoading(false);
    }
  }, [item.name, item.slot, item.rarity_id, item.upgradeLevel, points]);

  if (loading) return <div className="text-xs text-[var(--color-text-muted)] py-2">Загрузка графика...</div>;
  if (error) return <div className="text-xs text-red-400 py-2">{error}</div>;
  if (!points) {
    return (
      <button onClick={fetchHistory} className="text-xs text-[var(--color-accent-info)] hover:underline cursor-pointer py-1">
        📈 История цен
      </button>
    );
  }
  if (points.length < 2) {
    return <div className="text-xs text-[var(--color-text-muted)] py-2">Недостаточно данных для графика</div>;
  }

  const data = {
    labels: points.map(point => {
      const day = point.day.slice(0, 10).split('-');
      return `${day[2]}.${day[1]}`;
    }),
    datasets: [
      {
        label: 'Средняя', data: points.map(point => point.avg_price), borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2,
      },
      {
        label: 'Мин', data: points.map(point => point.min_price), borderColor: '#22c55e',
        borderDash: [3, 3], pointRadius: 0, borderWidth: 1, fill: false,
      },
      {
        label: 'Макс', data: points.map(point => point.max_price), borderColor: '#ef4444',
        borderDash: [3, 3], pointRadius: 0, borderWidth: 1, fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { callbacks: { label: (context: any) => `${context.dataset.label}: ${formatMoney(context.raw)} / шт` } },
    },
    scales: {
      x: { ticks: { font: { size: 9 }, color: '#888' }, grid: { display: false } },
      y: {
        ticks: {
          font: { size: 9 }, color: '#888',
          callback: (value: any) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value,
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  return (
    <div className="mt-2">
      <div className="text-[0.6rem] text-[var(--color-text-muted)] mb-1">Цена за 1 предмет</div>
      <div style={{ height: 120 }}><Line data={data} options={options as any} /></div>
    </div>
  );
}
