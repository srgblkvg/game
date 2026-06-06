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
    const [accountNumber, setAccountNumber] = useState('');

    // Transfer
    const [transferAccount, setTransferAccount] = useState('');
    const [transferAmount, setTransferAmount] = useState('');

    // History
    const [historyTab, setHistoryTab] = useState<'all' | 'in' | 'out'>('all');
    const [transfers, setTransfers] = useState<any[]>([]);

    useEffect(() => { if (!user) navigate('/login'); else { loadBank(); loadTransfers(); } }, [user]);
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown(prev => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown > 0]);

    const loadBank = async () => {
        try {
            const res = await fetch(`${BASE_URL}/bank`, { headers: getHeaders() });
            const data = await res.json();
            setPocket(data.pocket); setBank(data.bank);
            setCanVisit(data.canVisit); setCooldown(data.cooldownRemaining);
            setAccountNumber(data.accountNumber || '');
        } catch (e: any) { setError(e.message); }
    };

    const loadTransfers = async (filter = 'all') => {
        try {
            const res = await fetch(`${BASE_URL}/bank/transfers?filter=${filter}`, { headers: getHeaders() });
            setTransfers(await res.json());
        } catch {}
    };

    const handleDeposit = async () => {
        const amt = parseInt(amount);
        if (!amt || amt <= 0) { setError('Укажите сумму'); return; }
        try {
            const res = await fetch(`${BASE_URL}/bank/deposit`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ amount: amt }) });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setPocket(data.pocket); setBank(data.bank); setAmount('');
            setMessage(`Положено ${formatMoney(data.deposited)} (комиссия ${formatMoney(data.commission)})`); setError('');
        } catch (e: any) { setError(e.message); }
    };

    const handleWithdraw = async () => {
        const amt = parseInt(amount);
        if (!amt || amt <= 0) { setError('Укажите сумму'); return; }
        try {
            const res = await fetch(`${BASE_URL}/bank/withdraw`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ amount: amt }) });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setPocket(data.pocket); setBank(data.bank); setAmount('');
            setMessage(`Снято ${formatMoney(data.withdrawn)}`); setError('');
        } catch (e: any) { setError(e.message); }
    };

    const handleTransfer = async () => {
        const amt = parseInt(transferAmount);
        if (!transferAccount.trim()) { setError('Укажите номер счёта'); return; }
        if (!amt || amt <= 0) { setError('Укажите сумму'); return; }
        try {
            const res = await fetch(`${BASE_URL}/bank/transfer`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ accountNumber: transferAccount.trim().toUpperCase(), amount: amt }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setPocket(data.money); setTransferAccount(''); setTransferAmount('');
            setMessage(data.message); setError('');
            loadTransfers(historyTab);
        } catch (e: any) { setError(e.message); }
    };

    const switchHistoryTab = (f: 'all' | 'in' | 'out') => {
        setHistoryTab(f);
        loadTransfers(f);
    };

    const cooldownMin = Math.floor(cooldown / 60);
    const cooldownSec = cooldown % 60;

    return (
        <div className="max-w-md mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:bank" width="22" height="22" className="inline mr-2" />Банк</h1>

            <Card className="mb-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div><p className="text-xs text-[var(--color-text-muted)]">При себе</p><p className="text-lg font-bold">{formatMoney(pocket)}</p></div>
                    <div><p className="text-xs text-[var(--color-text-muted)]">В банке</p><p className="text-lg font-bold">{formatMoney(bank)}</p></div>
                </div>
            </Card>

            {accountNumber && (
                <Card className="mb-4 text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">Ваш номер счёта</p>
                    <p className="text-sm font-mono font-bold text-[var(--color-accent-info)] tracking-widest select-all">{accountNumber}</p>
                </Card>
            )}

            {!canVisit && cooldown > 0 && (
                <p className="text-sm text-[var(--color-text-muted)] mb-4 text-center">Следующий визит через {cooldownMin}:{String(cooldownSec).padStart(2, '0')}</p>
            )}

            <Card className="mb-4">
                <input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} min="1" />
                <div className="flex gap-3 mt-3">
                    <Button variant="primary" fullWidth onClick={handleDeposit} disabled={!canVisit}>📥 Положить (2%)</Button>
                    <Button variant="secondary" fullWidth onClick={handleWithdraw} disabled={!canVisit}>📤 Снять (0%)</Button>
                </div>
                {message && <p className="mt-2 text-sm text-[var(--color-accent-success)]">{message}</p>}
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </Card>

            <Card className="mb-4">
                <h3 className="font-bold text-sm mb-2">Перевод по номеру счёта</h3>
                <input type="text" placeholder="Номер счёта (6 символов)" value={transferAccount} onChange={e => setTransferAccount(e.target.value)} className={inputClass + ' mb-2'} maxLength={6} />
                <input type="number" placeholder="Сумма" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className={inputClass} min="1" />
                <Button variant="danger" fullWidth className="mt-3" onClick={handleTransfer}>💸 Перевести (2%)</Button>
            </Card>

            {/* История переводов */}
            <Card>
                <h3 className="font-bold text-sm mb-2">История переводов</h3>
                <div className="flex gap-2 mb-3">
                    <Button variant={historyTab === 'all' ? 'primary' : 'secondary'} size="xs" onClick={() => switchHistoryTab('all')}>Все</Button>
                    <Button variant={historyTab === 'in' ? 'primary' : 'secondary'} size="xs" onClick={() => switchHistoryTab('in')}>Входящие</Button>
                    <Button variant={historyTab === 'out' ? 'primary' : 'secondary'} size="xs" onClick={() => switchHistoryTab('out')}>Исходящие</Button>
                </div>
                {transfers.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Нет переводов</p>
                ) : (
                    <div className="space-y-2">
                        {transfers.map((t: any) => {
                            const isOut = t.fromUserId === user?.id;
                            return (
                                <div key={t.id} className="border-b border-[var(--color-border-light)] pb-2 text-xs">
                                    <div className="flex items-center gap-1">
                                        <span className={isOut ? 'text-red-400' : 'text-[var(--color-accent-success)]'}>
                                            {isOut ? '→' : '←'} {formatMoney(isOut ? t.amount : t.received)}
                                        </span>
                                        <span className="text-[var(--color-text-muted)]">
                                            {isOut ? `на счёт ${t.toAccount}` : `со счёта ${t.fromAccount}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[var(--color-text-muted)] mt-0.5">
                                        <span>{isOut ? `кому: ${t.toUsername}` : `от: (счёт ${t.fromAccount})`}{t.commission > 0 && isOut ? ` (ком. ${t.commission})` : ''}</span>
                                        <span>{new Date(t.createdAt + 'Z').toLocaleString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <Card className="mt-4">
                <h3 className="font-bold text-sm mb-2">Правила</h3>
                <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                    <li>• Вклад: комиссия 2%, снятие: бесплатно</li>
                    <li>• Один визит в 30 минут (все операции сразу)</li>
                    <li>• Серебро в банке защищено от PvP-грабежа</li>
                    <li>• Перевод по номеру счёта — комиссия 2%</li>
                </ul>
            </Card>
        </div>
    );
}
