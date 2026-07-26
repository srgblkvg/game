import PageHeader from '../components/ui/PageHeader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { getHeaders, BASE_URL } from '../api/helpers';
import { formatMoney } from '../utils/money';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from '../components/ItemStats';
import Button from '../components/ui/Button';

export default function ShopPage() {
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/shop'); if (c) setActionCard(c); }).catch(() => {}); }, []);
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [refreshSec, setRefreshSec] = useState(0);
  const dailyLimit = 10;

  const loadShop = async () => {
    try {
      const r = await fetch(`${BASE_URL}/shop`, { headers: getHeaders() });
      const d = await r.json();
      setOffers(d.offers || []);
      setTodayCount(d.todayCount || 0);
      setRefreshSec(Math.max(0, d.nextRefresh - Math.floor(Date.now() / 1000)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadShop();
  }, [user, navigate]);

  // Timer
  useEffect(() => {
    if (refreshSec <= 0) return;
    const t = setInterval(() => setRefreshSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [refreshSec]);

  const handleBuy = async (offerId: number) => {
    try {
      const r = await fetch(`${BASE_URL}/shop/buy`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
      const d = await r.json();
      if (!r.ok) { setMessage(d.error); return; }
      setMessage(d.itemName ? `Куплено: ${d.itemName}` : 'Куплено!');
      setCharacter(prev => prev ? { ...prev, money: d.moneyAfter } : prev);
      loadShop();
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  if (!user || !character) return null;

  const fmtRefresh = () => {
    const h = Math.floor(refreshSec / 3600);
    const m = Math.floor((refreshSec % 3600) / 60);
    const s = refreshSec % 60;
    return `${h}ч ${m}м ${s}с`;
  };

  return (
    <div className="px-4 py-4">
      <BackButton />
      {actionCard && <PageHeader title="Магазин" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
      <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-3">
        Ежедневное обновление ассортимента. 10 случайных предметов. Чем выше редкость — тем меньше шанс появления.
      </p>

      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="text-[var(--color-text-muted)]">
          Куплено сегодня: {todayCount}/{dailyLimit}
        </span>
        <span className="text-[var(--color-text-muted)]">
          🕐 Обновление через {fmtRefresh()}
        </span>
      </div>

      {message && <p className="mb-3 text-[var(--color-accent-success)] text-sm">{message}</p>}

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Загрузка...</p>
      ) : offers.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-center py-4">Нет предложений</p>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {offers.map((offer: any) => {
            const price = offer.price;
            const canAfford = character.money >= price;
            const color = offer.rarity_color || getRarityColor(offer);

            return (
              <div
                key={offer.id}
                className={`rounded-xl p-2 sm:p-3 flex flex-col border-2 border-solid bg-[var(--color-bg-card)] shadow-[0_4px_12px_rgba(0,0,0,0.8)] ${offer.bought ? 'opacity-50' : ''}`}
                style={{ borderColor: color }}
              >
                <div className="flex-1">
                  {offer.itemType === 'craft_item' ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="flex-shrink-0 rounded flex items-center justify-center"
                          style={{
                            width: 40, height: 40,
                            border: `2px solid ${color}`,
                            background: offer.image ? `url(${offer.image}) center / contain no-repeat` : color,
                          }}
                        />
                        <div className="font-bold text-xs leading-tight" style={{ color }}>
                          {offer.name}
                        </div>
                      </div>
                      <div className="text-xs text-center text-[var(--color-text-muted)]">
                        Редкость: {offer.rarity_display || 'Хлам'}
                      </div>
                    </div>
                  ) : (
                    <ItemStats item={offer} imageSize={40} />
                  )}
                </div>

                <div className="mt-2">
                  <div className="text-center text-[0.7rem] sm:text-xs text-[var(--color-text-secondary)] mb-1">
                    Цена: {formatMoney(price)}
                  </div>
                  {offer.bought ? (
                    <div className="text-center text-xs text-[var(--color-text-muted)] py-1">✓ Куплено</div>
                  ) : (
                    <Button
                      variant={canAfford ? 'success' : 'secondary'}
                      size="md"
                      fullWidth
                      onClick={() => handleBuy(offer.id)}
                      disabled={!canAfford || todayCount >= dailyLimit}
                    >
                      {todayCount >= dailyLimit ? 'Лимит' : 'Купить'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
