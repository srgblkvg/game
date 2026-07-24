import { useState, useEffect } from 'react';
import { getHeaders } from '../../api/helpers';
import { fmtSafeDate } from '../../utils/date';

interface Payment {
  id: number;
  platform: string;
  item: string;
  status: string;
  amount: string;
  username: string;
  user_id: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  chargeable: '✅ Выдан',
  succeeded: '✅ Выдан',
  refunded: '↩ Возврат',
  pending: '⏳ Ожидает',
  canceled: '❌ Отмена',
};

const ITEM_LABELS: Record<string, string> = {
  premium_7d: 'Премиум 7д',
  premium_30d: 'Премиум 30д',
  starter_pack: 'Стартовый набор',
  silver_1000: '1000💰',
  silver_5000: '5000💰',
  silver_10000: '10000💰',
  silver_50000: '50000💰',
  silver_100000: '100000💰',
  craft_rare: 'Сундук Редкий',
  craft_epic: 'Сундук Эпический',
};

export default function AdminDonate() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/admin/donate/history', { headers: getHeaders() })
      .then(r => r.json())
      .then(setPayments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all'
    ? payments
    : payments.filter(p => p.platform === filter);

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Загрузка...</p>;

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        {(['all', 'vk', 'yukassa'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs rounded cursor-pointer ${filter === f ? 'bg-[var(--color-accent-danger)] text-white' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'}`}
          >
            {f === 'all' ? 'Все' : f === 'vk' ? 'VK' : 'ЮKassa'}
          </button>
        ))}
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{filtered.length} платежей</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border-light)] text-[var(--color-text-muted)]">
              <th className="text-left py-1 px-2">#</th>
              <th className="text-left py-1 px-2">Товар</th>
              <th className="text-left py-1 px-2">Игрок</th>
              <th className="text-left py-1 px-2">Сумма</th>
              <th className="text-left py-1 px-2">Статус</th>
              <th className="text-left py-1 px-2">Дата</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={`${p.platform}-${p.id}`} className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-hover)]">
                <td className="py-1 px-2">
                  <span className={p.platform === 'vk' ? 'text-[var(--color-accent-info)]' : 'text-[var(--color-accent-warning)]'}>
                    {p.platform === 'vk' ? 'VK' : 'ЮK'}
                  </span>
                </td>
                <td className="py-1 px-2">{ITEM_LABELS[p.item] || p.item}</td>
                <td className="py-1 px-2">
                  {p.username ? (
                    <><span className="text-[var(--color-text-muted)]">#{p.user_id}</span> {p.username}</>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">#{p.user_id}</span>
                  )}
                </td>
                <td className="py-1 px-2">{p.amount || (p.status === 'chargeable' ? '✓' : '-')}</td>
                <td className="py-1 px-2">
                  <span className={p.status === 'chargeable' || p.status === 'succeeded' ? 'text-[var(--color-accent-success)]' : p.status === 'refunded' ? 'text-[var(--color-accent-danger)]' : 'text-[var(--color-text-muted)]'}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </td>
                <td className="py-1 px-2 text-[var(--color-text-muted)]">{fmtSafeDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
