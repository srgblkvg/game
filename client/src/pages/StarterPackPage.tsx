import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getHeaders } from '../api/helpers';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from '../components/ItemStats';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

const SLOT_LABELS: Record<string, string> = {
  weapon1: 'Оружие', shield: 'Щит', helmet: 'Шлем', chest: 'Нагрудник',
  gloves: 'Перчатки', boots: 'Ботинки', amulet: 'Амулет', ring: 'Кольцо', belt: 'Пояс',
};

const SLOT_ORDER = ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt'];

export default function StarterPackPage() {
  const navigate = useNavigate();
  const isVK = localStorage.getItem('isVK') === '1';

  const [equipment, setEquipment] = useState<any[]>([]);
  const [fragment, setFragment] = useState<any>(null);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState('');

  // Тултип
  const [tooltip, setTooltip] = useState<{ item: any; x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });

  const showTooltip = useCallback((item: any, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ item, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const M = 8;
    let left = tooltip.x - rect.width / 2;
    let top = tooltip.y - rect.height - M;
    if (top < M) top = tooltip.y + M;
    if (left < M) left = M;
    if (left + rect.width > window.innerWidth - M) left = window.innerWidth - rect.width - M;
    setTooltipPos({ left, top });
  }, [tooltip]);

  useEffect(() => {
    // Статус покупки
    fetch('/api/donate/starter-pack/status', { headers: getHeaders() })
      .then(r => r.json()).then(d => setPurchased(d.purchased)).catch(() => {});

    // Загружаем состав через preview, с fallback на /api/items
    fetch('/api/donate/starter-pack/preview', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.equipment && data.equipment.length > 0) {
          setEquipment(data.equipment);
          setFragment(data.fragment);
        } else {
          throw new Error('empty');
        }
      })
      .catch(() => {
        // Fallback: загружаем через старый API
        fetch('/api/items', { headers: getHeaders() })
          .then(r => r.json())
          .then((allItems: any[]) => {
            const common = allItems.filter((i: any) => i.rarity_id === 1);
            const picked: any[] = [];
            for (const slot of SLOT_ORDER) {
              const match = common.find((i: any) => i.slot === slot);
              if (match) picked.push(match);
            }
            setEquipment(picked);
          })
          .catch(() => {});
        // Фрагмент: хардкод-путь (файл в client/dist/fragment/)
        setFragment({ name: 'Фрагмент ужаса', image: '/fragment/fragment_green.webp', rarity_id: 2 });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = () => {
    if (isVK) {
      setBuying(true);
      setMessage('');
      (window as any).vkBridge?.send('VKWebAppShowOrderBox', { type: 'item', item: 'starter_pack' })
      .then((data: any) => {
        if (data?.status === 'cancelled') { setMessage(''); setBuying(false); return; }
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

  const imageUrl = (img: string | null) => {
    if (!img) return '';
    // Убираем ведущий слеш если есть (у craft_items пути с /, у items без)
    const clean = img.startsWith('/') ? img.slice(1) : img;
    return 'https://mmoarena.ru/' + clean;
  };

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
          <Card className="p-4 mb-4">
            <h3 className="font-bold text-sm mb-3">Состав набора:</h3>

            {/* Экипировка */}
            <div className="mb-3">
              <p className="text-xs text-[var(--color-accent-info)] mb-2">⚔️ Полный комплект обычной экипировки (9 предметов):</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {equipment.map((item, i) => {
                  const color = getRarityColor(item);
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-light)] cursor-pointer relative"
                      onMouseEnter={e => showTooltip(item, e)}
                      onMouseLeave={hideTooltip}
                    >
                      {item.image ? (
                        <img src={imageUrl(item.image)} alt={item.name} className="w-10 h-10 object-contain mb-1" />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center text-xl mb-1" style={{ color }}>?</div>
                      )}
                      <span className="text-[0.6rem] text-[var(--color-text-muted)] text-center leading-tight">{SLOT_LABELS[item.slot] || item.slot}</span>
                      <span className="text-[0.65rem] text-center leading-tight" style={{ color }}>{item.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Материалы */}
            <div className="mb-3 p-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-light)]">
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={imageUrl(fragment?.image || '/fragment/fragment_green.webp')}
                  alt="Фрагмент ужаса"
                  className="w-8 h-8 object-contain rounded"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <p className="text-xs text-[var(--color-accent-success)]">4× Фрагмент ужаса</p>
              </div>
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

      {/* Тултип */}
      {tooltip && createPortal(
        <div
          ref={tooltipRef}
          className="fixed bg-[var(--color-bg-secondary)] rounded-lg p-[0.7rem] z-[99999] text-[var(--color-text-primary)] text-xs max-w-[220px] pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.8)] border border-solid"
          style={{
            left: tooltipPos.left,
            top: tooltipPos.top,
            borderColor: getRarityColor(tooltip.item),
          }}
        >
          <ItemStats item={tooltip.item} imageSize={36} />
        </div>,
        document.body
      )}
    </div>
  );
}
