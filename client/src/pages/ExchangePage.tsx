import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getHeaders } from '../api/helpers';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

function formatMoney(n: number): string {
    return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));
}

// AMM price for buying dx gold
function buyPrice(dx: number, Rs: number, Rg: number): number {
    if (dx <= 0 || dx >= Rg) return Rs / Rg;
    return ((Rs * Rg) / (Rg - dx) - Rs) / dx;
}
// AMM price for selling dx gold
function sellPrice(dx: number, Rs: number, Rg: number): number {
    if (dx <= 0) return Rs / Rg;
    return (Rs - (Rs * Rg) / (Rg + dx)) / dx;
}

export default function ExchangePage() {
    const { character, setCharacter } = useGame();
    const [status, setStatus] = useState<any>(null);
    const [buyAmount, setBuyAmount] = useState(0);
    const [sellAmount, setSellAmount] = useState(0);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/exchange/status', { headers: getHeaders() });
            setStatus(await res.json());
        } catch {}
    };

    useEffect(() => {
        fetchStatus();
        const onStatus = (e: Event) => setStatus((e as CustomEvent).detail);
        window.addEventListener('exchange_status', onStatus);
        return () => window.removeEventListener('exchange_status', onStatus);
    }, []);

    const handleBuy = async () => {
        if (buyAmount <= 0) return;
        setError(''); setMessage(''); setLoading(true);
        try {
            const res = await fetch('/api/exchange/buy', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ goldAmount: buyAmount }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setMessage(`Куплено ${data.goldReceived} золота за ${data.silverPaid.toLocaleString()} серебра`);
            setCharacter((prev: any) => prev ? { ...prev, money: data.newSilver, gold: data.newGold } : prev);
            setBuyAmount(0);
            fetchStatus();
        } catch { setError('Ошибка сети'); }
        finally { setLoading(false); }
    };

    const handleSell = async () => {
        if (sellAmount <= 0) return;
        setError(''); setMessage(''); setLoading(true);
        try {
            const res = await fetch('/api/exchange/sell', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ goldAmount: sellAmount }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setMessage(`Продано ${data.goldSold} золота за ${data.silverReceived.toLocaleString()} серебра`);
            setCharacter((prev: any) => prev ? { ...prev, money: data.newSilver, gold: data.newGold } : prev);
            setSellAmount(0);
            fetchStatus();
        } catch { setError('Ошибка сети'); }
        finally { setLoading(false); }
    };

    if (!character || !status) return null;

    const maxBuy = Math.min(character.money, Math.floor(status.silver * 0.1)); // ограничим 10% казны
    const maxBuyGold = Math.floor(maxBuy / (status.buyPrice || 1));
    const maxSellGold = character.gold || 0;

    const estimatedBuyCost = buyAmount > 0 ? Math.ceil(buyAmount * buyPrice(buyAmount, status.silver, status.gold) * 1.05) : 0;
    const estimatedSellPayout = sellAmount > 0 ? Math.floor(sellAmount * sellPrice(sellAmount, status.silver, status.gold) * (status.sellCoef || 1) * 0.95) : 0;

    // Chart data: AMM price curve
    const Rg = status.gold, Rs = status.silver;
    const chartPoints = 40;
    const maxGoldRange = Math.floor(Rg * 0.25);
    const labels: string[] = [];
    const buyPrices: number[] = [];
    const sellPricesArr: number[] = [];
    for (let i = -maxGoldRange; i <= maxGoldRange; i += Math.max(1, Math.floor(maxGoldRange * 2 / chartPoints))) {
        labels.push(i === 0 ? '0' : (i > 0 ? '+' + formatMoney(i) : formatMoney(-i)));
        if (i > 0) {
            buyPrices.push(Math.round(buyPrice(i, Rs, Rg)));
            sellPricesArr.push(NaN as any);
        } else if (i < 0) {
            buyPrices.push(NaN as any);
            sellPricesArr.push(Math.round(sellPrice(-i, Rs, Rg) * (status.sellCoef || 1)));
        } else {
            buyPrices.push(status.basePrice);
            sellPricesArr.push(status.basePrice);
        }
    }

    const chartData = {
        labels,
        datasets: [
            {
                label: 'Покупка',
                data: buyPrices,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.1)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2, spanGaps: false,
            },
            {
                label: 'Продажа',
                data: sellPricesArr,
                borderColor: '#94a3b8',
                backgroundColor: 'rgba(148,163,184,0.05)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2, spanGaps: false,
            },
        ],
    };
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw.toLocaleString()} серебра` } },
        },
        scales: {
            x: { ticks: { font: { size: 9 }, color: '#888', maxTicksLimit: 8 }, grid: { display: false } },
            y: { ticks: { font: { size: 9 }, color: '#888', callback: (v: any) => formatMoney(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
            <h1 className="text-xl font-bold mb-0 text-center">🏦 Биржа</h1>

            {message && <div className="text-sm text-center text-[var(--color-accent-success)]">{message}</div>}
            {error && <div className="text-sm text-center text-[var(--color-accent-danger)]">{error}</div>}

            {/* Купить золото */}
            <Card>
                <h3 className="font-bold text-sm mb-3">💳 Купить золото</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Курс: 1 золото = 7 ₽. Покупка через VK Payments.</p>
                <div className="flex items-center gap-2">
                    <input type="number" inputMode="numeric" placeholder="Кол-во золота"
                        className="flex-1 bg-[var(--color-bg-input)] p-2 rounded text-sm border border-[var(--color-border-light)]"
                        onChange={() => {}} />
                    <Button variant="primary" size="md" disabled>Скоро</Button>
                </div>
            </Card>

            {/* График */}
            <Card>
                <h3 className="font-bold text-sm mb-2">Курс золота</h3>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div className="text-center">
                        <div className="text-[var(--color-text-muted)]">Покупка</div>
                        <div className="font-bold">{status.buyPrice?.toLocaleString()} серебра</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[var(--color-text-muted)]">Базовая</div>
                        <div className="font-bold text-[var(--color-accent-gold)]">{status.basePrice?.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[var(--color-text-muted)]">Продажа</div>
                        <div className="font-bold">{status.sellPrice?.toLocaleString()}</div>
                    </div>
                </div>
                <div style={{ height: 160 }}>
                    <Line data={chartData} options={chartOptions as any} />
                </div>
                <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mt-1">
                    <span>← продажа золота</span>
                    <span>покупка золота →</span>
                </div>
            </Card>

            {/* Купить за серебро */}
            <Card>
                <h3 className="font-bold text-sm mb-2">💰 Купить золото за серебро</h3>
                <div className="text-xs text-[var(--color-text-muted)] mb-2">
                    Доступно: {character.money.toLocaleString()} серебра
                </div>
                <input type="range" min={0} max={maxBuyGold} value={buyAmount}
                    onChange={e => setBuyAmount(parseInt(e.target.value))}
                    className="w-full mb-2 accent-[var(--color-accent-gold)]" />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--color-accent-gold)]">{buyAmount} золота</span>
                    <Button variant="primary" size="md" onClick={handleBuy} disabled={loading || buyAmount <= 0}>
                        Купить за {estimatedBuyCost.toLocaleString()} серебра
                    </Button>
                </div>
            </Card>

            {/* Продать за серебро */}
            <Card>
                <h3 className="font-bold text-sm mb-2">💱 Продать золото за серебро</h3>
                <div className="text-xs text-[var(--color-text-muted)] mb-2">
                    Доступно: {(character.gold || 0).toLocaleString()} золота
                </div>
                <input type="range" min={0} max={maxSellGold} value={sellAmount}
                    onChange={e => setSellAmount(parseInt(e.target.value))}
                    className="w-full mb-2 accent-[var(--color-accent-gold)]" />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--color-accent-gold)]">{sellAmount} золота</span>
                    <Button variant="secondary" size="md" onClick={handleSell} disabled={loading || sellAmount <= 0}>
                        Продать за {estimatedSellPayout.toLocaleString()} серебра
                    </Button>
                </div>
            </Card>

            {/* Баланс */}
            <Card>
                <div className="flex justify-between text-sm">
                    <span>Серебро: <b>{character.money.toLocaleString()}</b></span>
                    <span className="text-[var(--color-accent-gold)]">Золото: <b>{(character.gold || 0).toLocaleString()}</b></span>
                </div>
            </Card>
        </div>
    );
}
