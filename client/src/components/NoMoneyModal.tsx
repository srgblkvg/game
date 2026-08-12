import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Card from './ui/Card';
import { Icon } from '@iconify/react';

interface ModalData {
  type: 'noMoney' | 'inventoryFull';
  message: string;
  amount?: number;
}

export default function NoMoneyModal() {
  const [data, setData] = useState<ModalData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      setData({ type: 'noMoney', ...(e as CustomEvent<any>).detail });
    };
    const invHandler = (e: Event) => {
      setData({ type: 'inventoryFull', ...(e as CustomEvent<any>).detail });
    };
    window.addEventListener('noMoney', handler);
    window.addEventListener('inventoryFull', invHandler);
    return () => {
      window.removeEventListener('noMoney', handler);
      window.removeEventListener('inventoryFull', invHandler);
    };
  }, []);

  if (!data) return null;

  const isInvFull = data.type === 'inventoryFull';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setData(null)}>
      <Card className="max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <Icon icon={isInvFull ? "game-icons:backpack" : "game-icons:cash"} width="40" height="40" className="mx-auto mb-2 text-[var(--color-text-accent)]" />
          <h3 className="font-bold text-lg mb-2 text-[var(--color-accent-warning)]">
            {isInvFull ? 'Инвентарь заполнен' : 'Недостаточно серебра'}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">{data.message}</p>

          {isInvFull ? (
            <div className="text-xs text-[var(--color-text-muted)] space-y-1 mb-4 text-left">
              <p className="font-bold text-[var(--color-text-primary)]">Что делать:</p>
              <p>🗑️ Продайте или разберите ненужные предметы</p>
              <p>📦 Отправьте предметы на аукцион</p>
              <p>🔨 Используйте предметы в крафте/улучшении</p>
              <p>📥 Предметы с аукциона уходят на склад</p>
            </div>
          ) : (
            <div className="text-xs text-[var(--color-text-muted)] space-y-1 mb-4 text-left">
              <p className="font-bold text-[var(--color-text-primary)]">Где взять серебро:</p>
              <p>⚔️ PvP-бои и охота на мобов</p>
              <p>🔨 Работы в городе</p>
              <p>📦 Продажа предметов на аукционе</p>
              <p>💎 Купить серебро</p>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <Button variant="secondary" size="md" onClick={() => setData(null)}>Закрыть</Button>
            {isInvFull ? (
              <>
                <Button size="md" onClick={() => { setData(null); navigate('/auction'); }}>📦 Аукцион</Button>
                <Button size="md" onClick={() => { setData(null); navigate('/craft'); }}>🔨 Крафт</Button>
              </>
            ) : (
              <Button size="md" onClick={() => { setData(null); navigate('/bank?tab=exchange'); }}>
                💎 Купить
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Хелперы для вызова из любого места
export function showNoMoney(message: string, amount?: number) {
  window.dispatchEvent(new CustomEvent('noMoney', { detail: { message, amount } }));
}

export function showInventoryFull(message: string) {
  window.dispatchEvent(new CustomEvent('inventoryFull', { detail: { message } }));
}
