import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import { formatMoney } from '../utils/money';

export default function BankPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [pocket, setPocket] = useState(0);
    const [bank, setBank] = useState(0);
    const [canVisit, setCanVisit] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { if (!user) navigate('/login'); else loadBank(); }, [user]);
    // Live cooldown countdown
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown(prev => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown > 0]);

    const loadBank = async () => {
        try {
            const res = await fetch(`${BASE_URL}/bank`, { headers: getHeaders() });
            const data = await res.json();
            setPocket(data.pocket);
            setBank(data.bank);
            setCanVisit(data.canVisit);
            setCooldown(data.cooldownRemaining);
        } catch (e: any) { setError(e.message); }
    };

    const handleDeposit = async () => {
        const amt = parseInt(amount);
        if (!amt || amt <= 0) { setError('Укажите сумму'); return; }
        try {
            const res = await fetch(`${BASE_URL}/bank/deposit`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ amount: amt }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setPocket(data.pocket);
            setBank(data.bank);
            setAmount('');
            setMessage(`Положено ${formatMoney(data.deposited)} (комиссия ${formatMoney(data.commission)})`);
            setError('');
        } catch (e: any) { setError(e.message); }
    };

    const handleWithdraw = async () => {
        const amt = parseInt(amount);
        if (!amt || amt <= 0) { setError('Укажите сумму'); return; }
        try {
            const res = await fetch(`${BASE_URL}/bank/withdraw`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ amount: amt }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setPocket(data.pocket);
            setBank(data.bank);
            setAmount('');
            setMessage(`Снято ${formatMoney(data.withdrawn)}`);
            setError('');
        } catch (e: any) { setError(e.message); }
    };

    const cooldownMin = Math.floor(cooldown / 60);
    const cooldownSec = cooldown % 60;

    return (
        <div className="max-w-md mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:bank" width="22" height="22" className="inline mr-2" />Банк</h1>
            <p className="text-xs text-[var(--color-text-muted)] mb-4 italic">
                «Что положено в сундук — то не достанется грабителю. Что в кармане — то ветер.»
            </p>

            <Card className="mb-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)]">При себе</p>
                        <p className="text-lg font-bold">{formatMoney(pocket)} 🥇</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)]">В банке</p>
                        <p className="text-lg font-bold">{formatMoney(bank)} 🥇</p>
                    </div>
                </div>
            </Card>

            {!canVisit && cooldown > 0 && (
                <p className="text-sm text-[var(--color-text-muted)] mb-4 text-center">
                    Следующий визит через {cooldownMin}:{String(cooldownSec).padStart(2, '0')}
                </p>
            )}

            <Card className="mb-4">
                <input
                    type="number"
                    placeholder="Сумма"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className={inputClass}
                    min="1"
                />
                <div className="flex gap-3 mt-3">
                    <Button variant="primary" fullWidth onClick={handleDeposit} disabled={!canVisit}>
                        📥 Положить (2%)
                    </Button>
                    <Button variant="secondary" fullWidth onClick={handleWithdraw} disabled={!canVisit}>
                        📤 Снять (0%)
                    </Button>
                </div>
                {message && <p className="mt-2 text-sm text-[var(--color-accent-success)]">{message}</p>}
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </Card>

            <Card>
                <h3 className="font-bold text-sm mb-2">Правила</h3>
                <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                    <li>• Вклад: комиссия 2%, снятие: бесплатно</li>
                    <li>• Один визит в 30 минут (все операции сразу)</li>
                    <li>• Золото в банке защищено от PvP-грабежа</li>
                    <li>• Проценты не начисляются</li>
                </ul>
            </Card>
        </div>
    );
}
