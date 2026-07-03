import PageHeader from '../components/ui/PageHeader';
import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAcquire } from '../contexts/AcquireContext';
import { fetchShopItems, buyItem } from '../api';
import { getHeaders } from '../api/helpers';
import { formatMoney } from '../utils/money';
import { getRarityColor } from '../utils/itemUtils';
import ItemStats from '../components/ItemStats';
import Button from '../components/ui/Button';

const slotLabels: Record<string, string> = {
    weapon1: 'Оружие', shield: 'Щит', ring: 'Кольцо', helmet: 'Шлем',
    chest: 'Нагрудник', gloves: 'Перчатки', boots: 'Ботинки', amulet: 'Амулет', belt: 'Пояс',
};


const statNames: Record<string, string> = {
    s: 'сила', a: 'ловкость', d: 'защита', m: 'мастерство',
    crit: 'крит', dodge: 'уклон', counter: 'контрудар', fullBlock: 'полный блок',
};

export default function ShopPage() {
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/shop'); if (c) setActionCard(c); }).catch(() => {}); }, []);
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const { showAcquire } = useAcquire();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [todayCount, setTodayCount] = useState(0);
    const dailyLimit = 10;
    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchShopItems().then(setItems).catch(console.error).finally(() => setLoading(false));
        fetch('/api/shop/stats', { headers: getHeaders() }).then(r => r.json()).then(d => setTodayCount(d.todayCount || 0)).catch(() => {});
    }, [user, navigate]);

    const handleBuy = async (itemId: number) => {
        try {
            const res = await buyItem(itemId);
            setTodayCount(c => c + 1);
            const boughtItem = items.find(i => i.id === itemId);
            if (boughtItem) showAcquire(boughtItem, 1, 'Куплено');
            setCharacter(prev => prev ? { ...prev, money: res.moneyAfter } : prev);
        } catch (e: any) {
            setMessage(e.message);
        }
    };

    // Умный поиск
    const searchLower = searchQuery.toLowerCase().trim();
    const filteredItems = items.filter((item: any) => {
        if (!searchLower) return true;
        // По названию
        if ((item.name || '').toLowerCase().includes(searchLower)) return true;
        // По типу (слоту)
        if (slotLabels[item.slot]?.toLowerCase().includes(searchLower)) return true;
        if ((item.slot || '').toLowerCase().includes(searchLower)) return true;
        // По характеристикам
        if (item.bonuses) {
            for (const [k, v] of Object.entries(item.bonuses)) {
                if ((v as number) > 0 && statNames[k]?.includes(searchLower)) return true;
            }
        }
        if (item.extra) {
            for (const [k, v] of Object.entries(item.extra)) {
                if ((v as number) > 0 && statNames[k]?.includes(searchLower)) return true;
            }
        }
        return false;
    });

    // Группировка по слотам
    const grouped: Record<string, any[]> = {};
    for (const item of filteredItems) {
        const slot = item.slot || 'other';
        if (!grouped[slot]) grouped[slot] = [];
        grouped[slot].push(item);
    }


    if (!user || !character) return null;

    return (
        <div className="px-4 py-4">
            <BackButton />
          {actionCard && <PageHeader title="Магазин" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-3">
                Базовые предметы экипировки для первых шагов в игре. Нельзя надеть два одинаковых кольца.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
                Куплено сегодня: {todayCount}/{dailyLimit}
            </p>

            {message && <p className="mb-3 text-[var(--color-accent-success)] text-sm">{message}</p>}

            {/* Строка поиска */}
            <div className="mb-4">
                <div className="relative">
                    <Icon icon="game-icons:magnifying-glass" width="16" height="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        placeholder="Поиск по названию, типу или характеристикам..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] rounded-lg text-sm outline-none focus:border-[var(--color-accent-info)]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                        >
                            ✕
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Найдено: {filteredItems.length} предметов
                    </p>
                )}
            </div>

            {loading ? (
                <p className="text-[var(--color-text-muted)]">Загрузка...</p>
            ) : (
                <div>
                    {filteredItems.length === 0 && searchQuery && (
                        <p className="text-[var(--color-text-muted)] text-sm text-center py-4">Ничего не найдено</p>
                    )}
                    <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                        {filteredItems.map((item: any) => {
                            const price = item.cost ?? item.price ?? 100 * Math.pow(10, item.rarity_id);
                            const canAfford = character.money >= price;
                            const color = getRarityColor(item);

                            return (
                                <div
                                    key={item.id}
                                    className="rounded-xl p-2 sm:p-3 flex flex-col border-2 border-solid bg-[var(--color-bg-card)] shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                                    style={{ borderColor: color }}
                                >
                                    <div className="flex-1">
                                        <ItemStats item={item} imageSize={40} />
                                    </div>

                                    <div className="mt-2">
                                        <div className="text-center text-[0.7rem] sm:text-xs text-[var(--color-text-secondary)] mb-1">
                                            Цена: {formatMoney(price)}
                                        </div>
                                        <Button
                                            variant={canAfford ? 'success' : 'secondary'}
                                            size="md"
                                            fullWidth
                                            onClick={() => handleBuy(item.id)}
                                            disabled={!canAfford}
                                        >
                                            Купить
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
}
