import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getHeaders } from '../api/helpers';

// AMM: рассчитать цену для покупки dx золота
function buyPrice(dx: number, Rs: number, Rg: number): number {
    if (dx <= 0 || dx >= Rg) return 0;
    const newSilver = (Rs * Rg) / (Rg - dx);
    return (newSilver - Rs) / dx;
}

// AMM: рассчитать цену для продажи dx золота
function sellPrice(dx: number, Rs: number, Rg: number): number {
    if (dx <= 0) return 0;
    const newSilver = (Rs * Rg) / (Rg + dx);
    return (Rs - newSilver) / dx;
}

function formatMoney(n: number): string {
    return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));
}

export default function ExchangePage() {
    const { character, setCharacter } = useGame();
    const [status, setStatus] = useState<any>(null);
    const [goldAmount, setGoldAmount] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/exchange/status', { headers: getHeaders() });
            const data = await res.json();
            setStatus(data);
        } catch {}
    };

    useEffect(() => { fetchStatus(); }, []);

    const handleBuy = async () => {
        setError(''); setMessage('');
        const amount = parseInt(goldAmount);
        if (!amount || amount <= 0) { setError('Укажите количество золота'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/exchange/buy', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ goldAmount: amount }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setMessage(`Куплено ${data.goldReceived} золота за ${data.silverPaid.toLocaleString()} серебра`);
            setCharacter((prev: any) => prev ? { ...prev, money: data.newSilverBalance, gold: data.newGoldBalance } : prev);
            setGoldAmount('');
            fetchStatus();
        } catch { setError('Ошибка сети'); }
        finally { setLoading(false); }
    };

    const handleSell = async () => {
        setError(''); setMessage('');
        const amount = parseInt(goldAmount);
        if (!amount || amount <= 0) { setError('Укажите количество золота'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/exchange/sell', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ goldAmount: amount }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setMessage(`Продано ${data.goldSold} золота за ${data.silverReceived.toLocaleString()} серебра`);
            setCharacter((prev: any) => prev ? { ...prev, money: data.newSilverBalance, gold: data.newGoldBalance } : prev);
            setGoldAmount('');
            fetchStatus();
        } catch { setError('Ошибка сети'); }
        finally { setLoading(false); }
    };

    if (!character || !status) return null;

    const Rs = status.silver;
    const Rg = status.gold;
    const basePrice = status.basePrice;
    const comm = 0.05;

    // Генерируем точки для графика AMM
    const W = 300, H = 180, pad = { l: 45, r: 15, t: 15, b: 30 };
    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;

    const points: { x: number; y: number; price: number; gold: number }[] = [];
    const maxGold = Math.floor(Rg * 0.3); // показываем до 30% резерва золота
    const step = Math.max(1, Math.floor(maxGold / 50));

    for (let dx = -maxGold; dx <= maxGold; dx += step) {
        let price: number;
        if (dx < 0) {
            price = sellPrice(-dx, Rs, Rg) * (1 - comm) * (status.sellCoef || 1);
        } else if (dx > 0) {
            price = buyPrice(dx, Rs, Rg) * (1 + comm);
        } else {
            price = basePrice;
        }
        if (price > 0 && price < basePrice * 4) {
            points.push({ x: dx, y: price, price, gold: dx });
        }
    }

    const xScale = (v: number) => pad.l + ((v + maxGold) / (2 * maxGold)) * plotW;
    const maxPrice = basePrice * 2.5;
    const yScale = (v: number) => pad.t + plotH - (v / maxPrice) * plotH;

    const pathD = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'}${xScale(p.gold)},${yScale(p.price)}`
    ).join(' ');

    const xTicks = [-maxGold, -Math.floor(maxGold / 2), 0, Math.floor(maxGold / 2), maxGold];
    const yTicks = [0, basePrice / 2, basePrice, basePrice * 1.5, basePrice * 2];

    return (
        <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-4 text-center">🏦 Биржа</h1>

            {message && <div className="text-sm text-center mb-3 text-[var(--color-accent-success)]">{message}</div>}
            {error && <div className="text-sm text-center mb-3 text-[var(--color-accent-danger)]">{error}</div>}

            {/* График AMM */}
            <Card>
                <h3 className="font-bold text-sm mb-1">Кривая цены (AMM)</h3>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '220px' }}>
                    {/* Сетка */}
                    {yTicks.map(t => (
                        <g key={'y'+t}>
                            <line x1={pad.l} y1={yScale(t)} x2={W-pad.r} y2={yScale(t)} stroke="var(--color-border-light)" strokeWidth="0.5" />
                            <text x={pad.l-4} y={yScale(t)+3} textAnchor="end" fill="var(--color-text-muted)" fontSize="8">{formatMoney(t)}</text>
                        </g>
                    ))}
                    {xTicks.map(t => (
                        <text key={'x'+t} x={xScale(t)} y={H-pad.b+14} textAnchor="middle" fill="var(--color-text-muted)" fontSize="8">
                            {t === 0 ? 'сейчас' : (t > 0 ? `купить ${formatMoney(t)}` : `продать ${formatMoney(-t)}`)}
                        </text>
                    ))}
                    {/* Ось X */}
                    <line x1={pad.l} y1={yScale(0)} x2={W-pad.r} y2={yScale(0)} stroke="var(--color-text-muted)" strokeWidth="0.5" />
                    {/* Кривая */}
                    <path d={pathD} fill="none" stroke="var(--color-accent-gold)" strokeWidth="1.5" />
                    {/* Точка текущей цены */}
                    <circle cx={xScale(0)} cy={yScale(basePrice)} r="4" fill="var(--color-accent-gold)" stroke="var(--color-bg-card)" strokeWidth="2" />
                    {/* Метка базовой цены */}
                    <line x1={pad.l} y1={yScale(basePrice)} x2={W-pad.r} y2={yScale(basePrice)} stroke="var(--color-accent-gold)" strokeWidth="0.5" strokeDasharray="3,3" />
                </svg>
                <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mt-1">
                    <span>← продажа золота (дешевле)</span>
                    <span>покупка золота (дороже) →</span>
                </div>
            </Card>

            {/* Курс */}
            <Card>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-[var(--color-text-muted)]">Базовая цена:</div>
                    <div className="text-right font-bold">{basePrice?.toLocaleString()} серебра</div>
                    <div className="text-[var(--color-text-muted)]">Покупка:</div>
                    <div className="text-right text-[var(--color-accent-danger)]">~{status.buyPrice?.toLocaleString()}</div>
                    <div className="text-[var(--color-text-muted)]">Продажа:</div>
                    <div className="text-right text-[var(--color-accent-success)]">{status.sellPrice?.toLocaleString()}</div>
                    <div className="text-[var(--color-text-muted)]">Резерв:</div>
                    <div className="text-right">{status.silver?.toLocaleString()} серебра / {status.gold?.toLocaleString()} золота</div>
                </div>
            </Card>

            {/* Покупка золота за рубли */}
            <Card>
                <h3 className="font-bold text-sm mb-2">💳 Купить золото за рубли</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">Курс: 1 золото = 7 ₽</p>
                <Button variant="primary" size="md" fullWidth disabled>Скоро</Button>
            </Card>

            {/* Покупка за серебро */}
            <Card>
                <h3 className="font-bold text-sm mb-2">💰 Купить золото за серебро</h3>
                <div className="flex gap-2">
                    <input type="number" inputMode="numeric" placeholder="Кол-во золота"
                        className="flex-1 bg-[var(--color-bg-input)] p-2 rounded text-sm border border-[var(--color-border-light)]"
                        value={goldAmount} onChange={e => setGoldAmount(e.target.value)} />
                    <Button variant="primary" size="md" onClick={handleBuy} disabled={loading}>Купить</Button>
                </div>
                {goldAmount && (
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        ~{(parseInt(goldAmount) * (status.buyPrice || 0)).toLocaleString()} серебра
                    </div>
                )}
            </Card>

            {/* Продажа за серебро */}
            <Card>
                <h3 className="font-bold text-sm mb-2">💱 Продать золото за серебро</h3>
                <div className="flex gap-2">
                    <input type="number" inputMode="numeric" placeholder="Кол-во золота"
                        className="flex-1 bg-[var(--color-bg-input)] p-2 rounded text-sm border border-[var(--color-border-light)]"
                        value={goldAmount} onChange={e => setGoldAmount(e.target.value)} />
                    <Button variant="secondary" size="md" onClick={handleSell} disabled={loading}>Продать</Button>
                </div>
                {goldAmount && (
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        ~{(parseInt(goldAmount) * (status.sellPrice || 0)).toLocaleString()} серебра
                    </div>
                )}
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
