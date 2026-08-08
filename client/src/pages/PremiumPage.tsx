import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { getHeaders } from '../api/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function PremiumPage() {
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [selectedDays, setSelectedDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [paymentMsg, setPaymentMsg] = useState('');
    const isVK = localStorage.getItem('isVK') === '1';

    // Кулдауны рекламы
    const nowSec = Math.floor(Date.now() / 1000);
    const [adPremiumCd, setAdPremiumCd] = useState(Math.max(0, 3600 - (nowSec - ((character as any)?.adPremiumAt || 0))));
    const [adSilverCd, setAdSilverCd] = useState(Math.max(0, 1800 - (nowSec - ((character as any)?.adSilverAt || 0))));
    const [adLoading, setAdLoading] = useState<'premium' | 'silver' | null>(null);
    const adPremiumTimer = useRef<number>(0);
    const adSilverTimer = useRef<number>(0);

    useEffect(() => {
        if (adPremiumCd > 0) {
            adPremiumTimer.current = window.setInterval(() => setAdPremiumCd(c => Math.max(0, c - 1)), 1000);
            return () => clearInterval(adPremiumTimer.current);
        }
    }, [adPremiumCd > 0]);
    useEffect(() => {
        if (adSilverCd > 0) {
            adSilverTimer.current = window.setInterval(() => setAdSilverCd(c => Math.max(0, c - 1)), 1000);
            return () => clearInterval(adSilverTimer.current);
        }
    }, [adSilverCd > 0]);

    const handleAdReward = async (type: 'premium' | 'silver') => {
        setAdLoading(type);
        try {
            const bridge = (window as any).vkBridge;
            if (!bridge) throw new Error('Реклама доступна только в VK');
            const check: any = await bridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' });
            if (!check?.result) throw new Error('Реклама сейчас недоступна');
            const ad: any = await bridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
            if (!ad?.result) throw new Error('Реклама не досмотрена');

            const endpoint = type === 'premium' ? '/api/premium/ad' : '/api/shop/ad-silver';
            const res = await fetch(endpoint, { method: 'POST', headers: { ...getHeaders(), 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (type === 'premium') {
                setAdPremiumCd(3600);
                setCharacter({ ...character!, premium: { until: data.premiumUntil } });
            } else {
                setAdSilverCd(1800);
                setCharacter({ ...character!, money: (character?.money || 0) + 1000 });
            }
        } catch (e: any) {
            // silently ignore — user cancelled or ad unavailable
        } finally {
            setAdLoading(null);
        }
    };

    const plans = [
        { days: 7, price: 99, vkPrice: 14, vkItem: 'premium_7d', label: '7 дней' },
        { days: 30, price: 299, vkPrice: 42, vkItem: 'premium_30d', label: '30 дней' },
    ];

    const premiumUntil = character?.premium?.until || 0;
    const hasPremium = premiumUntil > Math.floor(Date.now() / 1000);

    // WS-бродкаст: оплата прошла (единственный статус который приходит)
    useEffect(() => {
        const handler = () => {
            setPaymentMsg('✅ Оплата прошла! Премиум активирован.');
            setTimeout(() => setPaymentMsg(''), 5000);
        };
        window.addEventListener('paymentStatus', handler);
        return () => window.removeEventListener('paymentStatus', handler);
    }, []);

    const handleBuy = () => {
        const plan = plans.find(p => p.days === selectedDays);
        if (!plan) return;

        if (isVK) {
            setPaymentMsg('');
            window.vkBridge!.send('VKWebAppShowOrderBox', {
                type: 'item',
                item: plan.vkItem,
            })
            .then((data: any) => {
                if (data?.status === 'cancelled') {
                    setPaymentMsg(''); // отмена — молча
                    return;
                }
                setPaymentMsg('Оплата открыта. Ожидайте подтверждения...');
            })
            .catch(() => { setPaymentMsg(''); });
        } else {
            buyWithYooKassa(plan);
        }
    };

    const buyWithYooKassa = async (plan: typeof plans[number]) => {
        setLoading(true);
        setPaymentMsg('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/yukassa/create-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ days: plan.days }),
            });
            const data = await res.json();
            if (data.confirmation_url) {
                window.open(data.confirmation_url, '_blank');
                setPaymentMsg('Оплата открыта. Ожидайте подтверждения...');
            } else {
                setPaymentMsg('❌ ' + (data.error || 'Не удалось создать платёж'));
            }
        } catch {
            setPaymentMsg('❌ Ошибка сети');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <button onClick={() => navigate(-1)} className="text-sm text-[var(--color-accent-info)] hover:underline mb-4 inline-block cursor-pointer">← Назад</button>

            <h1 className="text-xl font-bold text-center mb-1">⭐ Премиум</h1>
            <p className="text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-4">
                {hasPremium
                    ? `Активен до ${new Date(premiumUntil * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Премиум ускоряет кулдауны боёв, увеличивает доход и даёт пассивную регенерацию HP.'}
            </p>

            <Card className="p-4 mb-4">
                <h3 className="font-bold text-sm mb-3">Что даёт премиум:</h3>
                <ul className="text-sm text-[var(--color-text-secondary)] space-y-2">
                    <li>⚡ Кулдаун PvP: 5 мин вместо 10 • PvE: 2.5 мин вместо 5</li>
                    <li>💰 +30% серебра с PvE и работ</li>
                    <li>🏥 Автоматический реген HP (×3, как чулан в трактире)</li>
                    <li>📦 +10 слотов аукциона (всего 20)</li>
                    <li>⏭ Пропуск боя — мгновенное завершение PvE и PvP</li>
                </ul>
            </Card>

            <Card className="p-4 mb-4">
                <h3 className="font-bold text-sm mb-3">Выберите срок:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {plans.map(p => (
                        <button
                            key={p.days}
                            onClick={() => setSelectedDays(p.days)}
                            className={`p-2 rounded-lg border text-center text-sm transition-colors cursor-pointer ${selectedDays === p.days ? 'border-[var(--color-accent-info)] bg-[var(--color-accent-info)]/15 text-[var(--color-text-primary)]' : 'border-[var(--color-border-light)] hover:border-[var(--color-text-muted)]'}`}
                        >
                            <div className="font-bold">{p.label}</div>
                            <div className="text-[var(--color-accent-gold)] text-xs">
                                {isVK ? `${p.vkPrice} голосов` : `${p.price} ₽`}
                            </div>
                        </button>
                    ))}
                </div>
                <Button variant="danger" fullWidth onClick={handleBuy} disabled={loading}>
                    {loading ? '⏳' : (isVK ? '🛒' : '💳')} {loading ? 'Создание платежа...' : `Оплатить ${isVK ? `${plans.find(p => p.days === selectedDays)?.vkPrice} голосов` : `${plans.find(p => p.days === selectedDays)?.price} ₽`}`}
                </Button>
                <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-2 text-center">
                    {isVK
                        ? 'Оплата голосами ВКонтакте. Премиум активируется автоматически.'
                        : 'Оплата через ЮKassa. После оплаты премиум активируется автоматически.'}
                </p>
            </Card>

            {isVK && (
              <Card className="p-4 mb-4">
                <h3 className="font-bold text-sm mb-2">▶️ Бесплатный премиум</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">+1 час премиума за просмотр рекламы. Раз в час.</p>
                <Button variant="secondary" size="md" fullWidth onClick={() => handleAdReward('premium')} disabled={adPremiumCd > 0 || adLoading === 'premium'}>
                  {adLoading === 'premium' ? '⏳' : adPremiumCd > 0 ? `⏳ ${Math.ceil(adPremiumCd / 60)} мин` : '▶️ Смотреть рекламу'}
                </Button>
              </Card>
            )}

            {paymentMsg && (
                <div className={`rounded-xl p-3 mb-3 text-center text-sm font-bold ${paymentMsg.startsWith('✅') ? 'bg-[var(--color-accent-success)]/15 text-[var(--color-accent-success)]' : paymentMsg.startsWith('❌') ? 'bg-[var(--color-accent-danger)]/15 text-[var(--color-accent-danger)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-info)] border border-[var(--color-border-light)]'}`}>
                    {paymentMsg}
                </div>
            )}

            <Card className="p-4 mb-4">
                <h3 className="font-bold text-sm mb-2">📜 Публичная оферта</h3>
                <div className="text-xs text-[var(--color-text-muted)] space-y-2">
                    <p><strong>Продавец:</strong> Беляков Сергей Русланович</p>
                    <p><strong>ИНН:</strong> 253715362700</p>
                    <p><strong>Email:</strong> srgblkvvl@ya.ru</p>
                    <hr className="border-[var(--color-border-light)]" />
                    <p>1. Предмет оферты: предоставление доступа к премиум-функциям игры MMO Arena на определённый срок.</p>
                    <p>2. Премиум-статус активируется автоматически после поступления оплаты. Срок действия — выбранное количество дней с момента активации.</p>
                    <p>3. Возврат средств не предусмотрен — вы можете оценить игру бесплатно до покупки.</p>
                    <p>4. {isVK ? 'Оплата производится голосами ВКонтакте.' : 'Оплата производится через платёжную систему ЮKassa.'} Продавец не хранит платёжные данные.</p>
                    <p>5. Принимая условия оферты, вы соглашаетесь с <span className="text-[var(--color-accent-info)] cursor-pointer hover:underline" onClick={() => navigate('/rules')}>правилами игры</span> и <span className="text-[var(--color-accent-info)] cursor-pointer hover:underline" onClick={() => navigate('/privacy')}>обработкой данных</span>.</p>
                </div>
            </Card>
        </div>
    );
}
