import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Card from './ui/Card';
import { Icon } from '@iconify/react';

interface NoMoneyData {
  message: string;
  amount?: number;
}

export default function NoMoneyModal() {
  const [data, setData] = useState<NoMoneyData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      setData((e as CustomEvent<NoMoneyData>).detail);
    };
    window.addEventListener('noMoney', handler);
    return () => window.removeEventListener('noMoney', handler);
  }, []);

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setData(null)}>
      <Card className="max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <Icon icon="game-icons:cash" width="40" height="40" className="mx-auto mb-2 text-[var(--color-text-accent)]" />
          <h3 className="font-bold text-lg mb-2 text-[var(--color-accent-warning)]">Недостаточно серебра</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">{data.message}</p>

          <div className="text-xs text-[var(--color-text-muted)] space-y-1 mb-4 text-left">
            <p className="font-bold text-[var(--color-text-primary)]">Где взять серебро:</p>
            <p>⚔️ PvP-бои и охота на мобов</p>
            <p>🔨 Работы в городе</p>
            <p>📦 Продажа предметов на аукционе</p>
            <p>💎 Обменять голоса ВК на серебро</p>
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="secondary" size="md" onClick={() => setData(null)}>Закрыть</Button>
            <Button size="md" onClick={() => { setData(null); navigate('/bank?tab=exchange'); }}>
              💎 Обменять
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Хелпер для вызова из любого места
export function showNoMoney(message: string, amount?: number) {
  window.dispatchEvent(new CustomEvent('noMoney', { detail: { message, amount } }));
}
