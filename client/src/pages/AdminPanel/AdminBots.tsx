import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

interface BotInfo {
  id: number;
  username: string;
  running: boolean;
  actions: number;
  lastAction: string;
  lastResult: string;
}

export default function AdminBots() {
  const { token } = useAuth();
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(3);
  const [useExisting, setUseExisting] = useState(true);
  const [error, setError] = useState('');

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bots', { headers });
      const data = await res.json();
      setRunning(data.running);
      setBots(data.bots || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/bots/start', {
        method: 'POST', headers,
        body: JSON.stringify({ count, useExisting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/bots/stop', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const actionLabels: Record<string, string> = {
    pve: 'PvE', pvp: 'PvP', job: 'Работа', shop_buy: 'Магазин',
    auction: 'Аукцион', craft: 'Крафт', rest: 'Таверна',
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">Количество ботов</label>
          <input
            type="number" min={1} max={50} value={count}
            onChange={e => setCount(parseInt(e.target.value) || 1)}
            className="w-20 px-2 py-1 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-light)] text-sm"
          />
        </div>
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input
            type="checkbox" checked={useExisting}
            onChange={e => setUseExisting(e.target.checked)}
          />
          Использовать существующих
        </label>
        <Button variant="primary" size="md" onClick={handleStart} disabled={loading || running}>
          {loading ? '...' : '▶ Запустить'}
        </Button>
        <Button variant="danger" size="md" onClick={handleStop} disabled={loading || !running}>
          ⏹ Остановить
        </Button>
      </div>
      {error && <p className="text-[var(--color-accent-danger)] text-sm mb-2">{error}</p>}

      <div className={`text-sm mb-3 ${running ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
        Статус: {running ? `🟢 Запущено (${bots.length})` : '🔴 Остановлено'}
      </div>

      {bots.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border-light)]">
                <th className="text-left py-1 px-2">ID</th>
                <th className="text-left py-1 px-2">Имя</th>
                <th className="text-left py-1 px-2">Действий</th>
                <th className="text-left py-1 px-2">Последнее</th>
                <th className="text-left py-1 px-2">Результат</th>
              </tr>
            </thead>
            <tbody>
              {bots.map(b => (
                <tr key={b.id} className="border-b border-[var(--color-border-light)]/30 hover:bg-[var(--color-bg-hover)]">
                  <td className="py-1 px-2 text-[var(--color-text-muted)]">{b.id}</td>
                  <td className="py-1 px-2 font-medium">{b.username}</td>
                  <td className="py-1 px-2">{b.actions}</td>
                  <td className="py-1 px-2">{actionLabels[b.lastAction] || b.lastAction || '—'}</td>
                  <td className="py-1 px-2 text-[var(--color-text-muted)] max-w-[200px] truncate">{b.lastResult || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
