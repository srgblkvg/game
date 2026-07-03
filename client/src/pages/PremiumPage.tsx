import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function PremiumPage() {
    const { character } = useGame();
    const navigate = useNavigate();
    const [selectedDays, setSelectedDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [paymentMsg, setPaymentMsg] = useState('');
    const isVK = localStorage.getItem('isVK') === '1';

    const plans = [
        { days: 7, price: 99, vkPrice: 14, vkItem: 'premium_7d', label: '7 дней' },
        { days: 30, price: 299, vkPrice: 42, vkItem: 'premium_30d', label: '30 дней' },
    ];

    const premiumUntil = character?.premium?.until || 0;
    const hasPremium = premiumUntil > Math.floor(Date.now() / 1000);

    // Авто-обнаружение активации премиума
    useEffect(() => {
        if (paymentMsg === 'Оплата открыта. Ожидайте подтверждения...' && hasPremium) {
            setPaymentMsg('✅ Оплата прошла! Премиум активирован.');
            const t = setTimeout(() => setPaymentMsg(''), 5000);
            return () => clearTimeout(t);
        }
    }, [hasPremium, paymentMsg]);

    const handleBuy = () => {
        const plan = plans.find(p => p.days === selectedDays);
        if (!plan) return;

        if (isVK) {
            // VK: вызываем платёжный диалог
            setPaymentMsg('');
            window.vkBridge!.send('VKWebAppShowOrderBox', {
                type: 'item',
                item: plan.vkItem,
            })
            .then((data: any) => {
                if (data?.status === 'cancelled') {
                    setPaymentMsg('❌ Оплата отменена');
                    return;
                }
                // Платёж открыт — ожидаем обновления персонажа (GameContext сам обновляет)
                setPaymentMsg('Оплата открыта. Ожидайте подтверждения...');
            })
            .catch((err: unknown) => {
                setPaymentMsg('❌ Ошибка: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
            });
        } else {
            // YooKassa (обычный сайт)
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
                // Ждём подтверждения (polling статуса)
                const check = setInterval(async () => {
                    try {
                        const r = await fetch('/api/character', { headers: { 'Authorization': `Bearer ${token}` } });
                        const ch = await r.json();
                        if (ch.premium && ch.premium > Math.floor(Date.now() / 1000)) {
                            clearInterval(check);
                            setPaymentMsg('✅ Оплата прошла! Премиум активирован.');
                            setTimeout(() => setPaymentMsg(''), 5000);
                        }
                    } catch {}
                }, 3000);
                setTimeout(() => clearInterval(check), 120000); // 2 мин таймаут
            } else {
                setPaymentMsg('❌ Ошибка: ' + (data.error || 'Не удалось создать платёж'));
            }
        } catch (err: unknown) {
            setPaymentMsg('❌ Ошибка: ' + (err instanceof Error ? err.message : 'Сетевая ошибка'));
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

            {/* Что даёт премиум */}
            <Card className="p-4 mb-4">
                <h3 className="font-bold text-sm mb-3">Что даёт премиум:</h3>
                <ul className="text-sm text-[var(--color-text-secondary)] space-y-2">
                    <li>⚡ Кулдаун PvP: 5 мин вместо 10 • PvE: 2.5 мин вместо 5</li>
                    <li>💰 +30% серебра с PvE и работ</li>
                    <li>🏥 Автоматический реген HP (×3, как чулан в трактире)</li>
                    <li>⏭ Пропуск боя — мгновенное завершение PvE и PvP</li>
                </ul>
            </Card>

            {/* Выбор плана */}
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

            {paymentMsg && (
                <div className={`rounded-xl p-3 mb-3 text-center text-sm font-bold ${paymentMsg.startsWith('✅') ? 'bg-[var(--color-accent-success)]/15 text-[var(--color-accent-success)]' : paymentMsg.startsWith('❌') ? 'bg-[var(--color-accent-danger)]/15 text-[var(--color-accent-danger)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-info)] border border-[var(--color-border-light)]'}`}>
                    {paymentMsg}
                </div>
            )}

            {/* Публичная оферта */}
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
