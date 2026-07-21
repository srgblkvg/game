import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHeaders } from '../api/helpers';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

const SLOT_LABELS: Record<string, string> = {
  weapon1: 'Оружие', shield: 'Щит', helmet: 'Шлем', chest: 'Нагрудник',
  gloves: 'Перчатки', boots: 'Ботинки', amulet: 'Амулет', ring: 'Кольцо', belt: 'Пояс',
};

const SLOT_ORDER = ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt'];

interface PackItem {
  name: string;
  slot: string;
  image: string | null;
}

export default function StarterPackPage() {
  const navigate = useNavigate();
  const isVK = localStorage.getItem('isVK') === '1';

  const [items, setItems] = useState<PackItem[]>([]);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Проверяем статус покупки
    fetch('/api/donate/starter-pack/status', { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setPurchased(d.purchased))
      .catch(() => {});

    // Загружаем обычные предметы для показа
    fetch('/api/items', { headers: getHeaders() })
      .then(r => r.json())
      .then((allItems: any[]) => {
        const common = allItems.filter((i: any) => i.rarity_id === 1);
        const picked: PackItem[] = [];
        for (const slot of SLOT_ORDER) {
          const match = common.find((i: any) => i.slot === slot);
          if (match) picked.push({ name: match.name, slot: match.slot, image: match.image });
        }
        setItems(picked);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = () => {
    if (isVK) {
      setBuying(true);
      setMessage('');
      (window as any).vkBridge?.send('VKWebAppShowOrderBox', {
        type: 'item',
        item: 'starter_pack',
      })
      .then((data: any) => {
        if (data?.status === 'cancelled') {
          setMessage('');
          setBuying(false);
          return;
        }
        setMessage('Оплата открыта. Ожидайте подтверждения...');
      })
      .catch(() => { setMessage(''); setBuying(false); });
    } else {
      setBuying(true);
      setMessage('');
      const token = localStorage.getItem('token');
      fetch('/api/yukassa/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ item: 'starter_pack' }),
      })
      .then(r => r.json())
      .then(data => {
        if (data.confirmation_url) {
          window.open(data.confirmation_url, '_blank');
          setMessage('Оплата открыта. Ожидайте подтверждения...');
        } else {
          setMessage('❌ ' + (data.error || 'Не удалось создать платёж'));
        }
      })
      .catch(() => setMessage('❌ Ошибка сети'))
      .finally(() => setBuying(false));
    }
  };

  // WS уведомление об успешной оплате
  useEffect(() => {
    const handler = () => {
      setPurchased(true);
      setMessage('✅ Стартовый набор получен! Проверьте инвентарь.');
      setBuying(false);
    };
    window.addEventListener('paymentStatus', handler);
    return () => window.removeEventListener('paymentStatus', handler);
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-[var(--color-text-muted)] text-sm">Загрузка...</div></div>;

  const imageUrl = (img: string | null) =>
    img ? `https://mmoarena.ru/${img}` : '';

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <button onClick={() => navigate(-1)} className="text-sm text-[var(--color-accent-info)] hover:underline mb-4 inline-block cursor-pointer">← Назад</button>

      <h1 className="text-xl font-bold text-center mb-1">🎁 Стартовый набор</h1>
      <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-4">
        Одноразовый набор для быстрого старта. Включает полный комплект обычной экипировки, материалы для крафта, серебро и премиум.
      </p>

      {purchased ? (
        <Card className="p-4 text-center">
          <p className="text-lg font-bold text-[var(--color-accent-success)] mb-2">✅ Уже получен</p>
          <p className="text-sm text-[var(--color-text-muted)]">Стартовый набор уже активирован на вашем аккаунте.</p>
          <Button variant="primary" size="md" className="mt-3" onClick={() => navigate('/shop')}>В магазин</Button>
        </Card>
      ) : (
        <>
          {/* Состав набора */}
          <Card className="p-4 mb-4">
            <h3 className="font-bold text-sm mb-3">Состав набора:</h3>

            {/* Экипировка */}
            <div className="mb-3">
              <p className="text-xs text-[var(--color-accent-info)] mb-2">⚔️ Полный комплект обычной экипировки (9 предметов):</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {items.map((item, i) => (
                  <div key={i} className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
                    {item.image ? (
                      <img src={imageUrl(item.image)} alt={item.name} className="w-10 h-10 object-contain mb-1" />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center text-xl mb-1">❓</div>
                    )}
                    <span className="text-[0.6rem] text-[var(--color-text-muted)] text-center leading-tight">{SLOT_LABELS[item.slot] || item.slot}</span>
                    <span className="text-[0.65rem] text-[var(--color-text-primary)] text-center leading-tight">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Материалы */}
            <div className="mb-3 p-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
              <p className="text-xs text-[var(--color-accent-success)] mb-1">🔮 4× Фрагмент ужаса</p>
              <p className="text-[0.6rem] text-[var(--color-text-muted)]">Необычный материал для крафта. Используется в рецептах улучшения и создания предметов.</p>
            </div>

            {/* Серебро */}
            <div className="mb-3 p-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
              <p className="text-xs text-[var(--color-accent-warning)] mb-1">💰 {formatMoney(1000)}</p>
              <p className="text-[0.6rem] text-[var(--color-text-muted)]">Хватит на первые покупки в магазине или взнос в гильдию.</p>
            </div>

            {/* Премиум */}
            <div className="p-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
              <p className="text-xs text-[var(--color-accent-gold)] mb-1">⭐ Премиум на 7 дней</p>
              <p className="text-[0.6rem] text-[var(--color-text-muted)]">Ускоренные кулдауны, +30% серебра, авто-реген HP, пропуск боёв.</p>
            </div>
          </Card>

          {/* Цена и покупка */}
          <Card className="p-4 mb-4">
            <div className="text-center mb-3">
              <span className="text-2xl font-bold text-[var(--color-accent-gold)]">
                {isVK ? '14 голосов' : '99 ₽'}
              </span>
            </div>
            <Button variant="danger" fullWidth onClick={handleBuy} disabled={buying}>
              {buying ? '⏳ Создание платежа...' : (isVK ? '🛒 Купить за голоса' : '💳 Оплатить 99 ₽')}
            </Button>
            <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-2 text-center">
              Одноразовая покупка. {isVK ? 'Оплата голосами ВКонтакте.' : 'Оплата через ЮKassa.'}
            </p>
          </Card>
        </>
      )}

      {message && (
        <div className={`rounded-xl p-3 mb-3 text-center text-sm font-bold ${message.startsWith('✅') ? 'bg-[var(--color-accent-success)]/15 text-[var(--color-accent-success)]' : message.startsWith('❌') ? 'bg-[var(--color-accent-danger)]/15 text-[var(--color-accent-danger)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-info)] border border-[var(--color-border-light)]'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
