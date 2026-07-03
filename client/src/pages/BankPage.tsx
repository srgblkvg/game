import PageHeader from '../components/ui/PageHeader';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { fmtSafeDate, safeDate } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import { formatMoney } from '../utils/money';

export default function BankPage() {
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/bank'); if (c) setActionCard(c); }).catch(() => {}); }, []);
    const { user } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState<'info' | 'deposit' | 'transfer'>('info');
    const [accountNumber, setAccountNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [transferAccount, setTransferAccount] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [historyTab, setHistoryTab] = useState<'all' | 'in' | 'out'>('all');
    const [opsTab, setOpsTab] = useState<'all' | 'deposit' | 'withdraw'>('all');
    const [transfers, setTransfers] = useState<any[]>([]);
    const [operations, setOperations] = useState<any[]>([]);

    useEffect(() => { if (!user) navigate('/login'); else { loadBank(); loadTransfers(); loadOperations(); } }, [user]);

    // Баланс через WS —实时 обновление
    useEffect(() => {
        const onBalance = (e: Event) => {
            if ((window as any).__battling) return;
            const { money, bank: wsBank } = (e as CustomEvent).detail;
            if (money !== undefined) setPocket(money);
            if (wsBank !== undefined) setBank(wsBank);
        };
        window.addEventListener('balance', onBalance);
        return () => window.removeEventListener('balance', onBalance);
    }, []);

    const loadBank = async () => { try { const r = await fetch(`${BASE_URL}/bank`,{headers:getHeaders()}); const d = await r.json(); setPocket(d.pocket); setBank(d.bank); setAccountNumber(d.accountNumber||''); } catch{} };
    const loadTransfers = async (f='all') => { try { setTransfers(await (await fetch(`${BASE_URL}/bank/transfers?filter=${f}&limit=20`,{headers:getHeaders()})).json()); } catch{} };
    const loadOperations = async (f='all') => { try { setOperations(await (await fetch(`${BASE_URL}/bank/operations?filter=${f}&limit=20`,{headers:getHeaders()})).json()); } catch{} };

    const api = async (url: string, body?: any) => {
        const r = await fetch(`${BASE_URL}${url}`, { method: body?'POST':'GET', headers: getHeaders(), body: body?JSON.stringify(body):undefined });
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
    };

    const depositCommission = Math.ceil((parseInt(amount) || 0) * 0.02);
    const transferCommission = Math.ceil((parseInt(transferAmount) || 0) * 0.02);

    const handleDeposit = async () => {
        const amt = parseInt(amount); if (!amt||amt<=0) { setError('Укажите сумму'); return; }
        try { const d = await api('/bank/deposit',{amount:amt}); setPocket(d.pocket); setBank(d.bank); setAmount(''); setMessage(`Положено ${formatMoney(d.deposited)}`); setError(''); loadOperations(); } catch(e:any){setError(e.message)}
    };
    const handleWithdraw = async () => {
        const amt = parseInt(amount); if (!amt||amt<=0) { setError('Укажите сумму'); return; }
        try { const d = await api('/bank/withdraw',{amount:amt}); setPocket(d.pocket); setBank(d.bank); setAmount(''); setMessage(`Снято ${formatMoney(d.withdrawn)}`); setError(''); loadOperations(); } catch(e:any){setError(e.message)}
    };
    const handleTransfer = async () => {
        const amt = parseInt(transferAmount); if (!transferAccount.trim()) { setError('Укажите номер счёта'); return; } if (!amt||amt<=0) { setError('Укажите сумму'); return; }
        try { const d = await api('/bank/transfer',{accountNumber:transferAccount.trim().toUpperCase(),amount:amt}); setBank(d.bank); setTransferAccount(''); setTransferAmount(''); setMessage(d.message); setError(''); loadTransfers(); } catch(e:any){setError(e.message)}
    };

    const allHistory = [...transfers.map((t:any)=>({...t,_type:'transfer'})), ...operations.map((o:any)=>({...o,_type:'operation'}))].sort((a,b)=>(safeDate(b.createdAt)?.getTime()||0)-(safeDate(a.createdAt)?.getTime()||0)).slice(0,20);

    return (
        <div className="max-w-md mx-auto px-4 py-4">
            <BackButton />
          {actionCard && <PageHeader title="Банк" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
            {accountNumber && <Card className="mb-3 text-center"><p className="text-xs text-[var(--color-text-muted)]">Номер счёта</p><p className="text-sm font-mono font-bold text-[var(--color-accent-info)] tracking-widest select-all">{accountNumber}</p></Card>}
            <div className="flex gap-2 mb-3">{(['info','deposit','transfer'] as const).map(t => <Button key={t} variant={tab===t?'primary':'secondary'} size="md" onClick={()=>{setTab(t);setMessage('');setError('');}}>{t==='info'?'История операций':t==='deposit'?'Пополнить/Снять':'Переводы'}</Button>)}</div>
            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {tab==='info' && <Card>
                <h3 className="font-bold text-sm mb-2">История операций</h3>
                {allHistory.length===0 ? <p className="text-xs text-[var(--color-text-muted)]">Нет операций</p> :
                <div className="space-y-2">{allHistory.map((h:any)=>{
                    if (h._type==='transfer') { const out = h.fromUserId===user?.id; return <div key={'t'+h.id} className="border-b border-[var(--color-border-light)] pb-2 text-xs"><div className="flex items-center gap-1"><span className={out?'text-[var(--color-accent-danger)]':'text-[var(--color-accent-success)]'}>{out?'→':'←'} {formatMoney(out?h.amount:h.received)}</span><span className="text-[var(--color-text-muted)]">{out?`на ${h.toAccount}`:`от ${h.fromAccount}`}{h.commission>0&&out?`, ком. ${h.commission}`:''}</span><span className="ml-auto text-[var(--color-text-muted)]">{fmtSafeDate(h.createdAt)}</span></div></div>; }
                    return <div key={'o'+h.id} className="border-b border-[var(--color-border-light)] pb-2 text-xs"><div className="flex items-center gap-1"><span className={h.type==='deposit'?'text-[var(--color-accent-success)]':'text-[var(--color-accent-danger)]'}>{h.type==='deposit'?'📥':'📤'} {formatMoney(h.amount)}</span>{h.commission>0&&<span className="text-[var(--color-text-muted)]">ком. {formatMoney(h.commission)}</span>}<span className="ml-auto text-[var(--color-text-muted)]">{fmtSafeDate(h.createdAt)}</span></div></div>;
                })}</div>}
            </Card>}

            {tab==='deposit' && <>
                <Card className="mb-3">
                    <h3 className="font-bold text-sm mb-2">Пополнение и снятие</h3>
                    <input type="number" placeholder="Сумма" value={amount} onChange={e=>setAmount(e.target.value)} className={inputClass} min="1" />
                    {depositCommission > 0 && <p className="text-xs text-[var(--color-text-muted)] mt-1">Комиссия: {formatMoney(depositCommission)} (зачислено: {formatMoney((parseInt(amount)||0) - depositCommission)})</p>}
                    <div className="flex gap-3 mt-3"><Button variant="primary" fullWidth onClick={handleDeposit}>📥 Положить (2%)</Button><Button variant="secondary" fullWidth onClick={handleWithdraw}>📤 Снять (0%)</Button></div>
                </Card>
                <Card className="mb-3">
                    <h3 className="font-bold text-sm mb-2">История вкладов</h3>
                    <div className="flex gap-2 mb-3">{(['all','deposit','withdraw'] as const).map(f => <Button key={f} variant={opsTab===f?'primary':'secondary'} size="md" onClick={()=>{setOpsTab(f);loadOperations(f);}}>{f==='all'?'Все':f==='deposit'?'Пополнение':'Снятие'}</Button>)}</div>
                    {operations.length===0 ? <p className="text-xs text-[var(--color-text-muted)]">Нет операций</p> :
                    <div className="space-y-2">{operations.map((o:any)=><div key={o.id} className="border-b border-[var(--color-border-light)] pb-2 text-xs"><div className="flex items-center gap-1"><span className={o.type==='deposit'?'text-[var(--color-accent-success)]':'text-[var(--color-accent-danger)]'}>{o.type==='deposit'?'📥':'📤'} {formatMoney(o.amount)}</span>{o.commission>0&&<span className="text-[var(--color-text-muted)]">ком. {formatMoney(o.commission)}</span>}<span className="ml-auto text-[var(--color-text-muted)]">{fmtSafeDate(o.createdAt)}</span></div><div className="text-[var(--color-text-muted)]">{o.type==='deposit'?`Зачислено: ${formatMoney(o.result)}`:`Получено: ${formatMoney(o.result)}`}</div></div>)}</div>}
                </Card>
            </>}

            {tab==='transfer' && <>
                <Card className="mb-3">
                    <h3 className="font-bold text-sm mb-2">Перевод по номеру счёта</h3>
                    <input type="text" placeholder="Номер счёта (6 символов)" value={transferAccount} onChange={e=>setTransferAccount(e.target.value)} className={inputClass+' mb-2'} maxLength={6} />
                    <input type="number" placeholder="Сумма" value={transferAmount} onChange={e=>setTransferAmount(e.target.value)} className={inputClass} min="1" />
                    {transferCommission > 0 && <p className="text-xs text-[var(--color-text-muted)] mt-1">Комиссия: {formatMoney(transferCommission)} (получатель получит: {formatMoney((parseInt(transferAmount)||0) - transferCommission)})</p>}
                    <Button variant="danger" fullWidth className="mt-3" onClick={handleTransfer}>💸 Перевести (2%)</Button>
                </Card>
                <Card className="mb-3">
                    <h3 className="font-bold text-sm mb-2">История переводов</h3>
                    <div className="flex gap-2 mb-3">{(['all','in','out'] as const).map(f => <Button key={f} variant={historyTab===f?'primary':'secondary'} size="md" onClick={()=>{setHistoryTab(f);loadTransfers(f);}}>{f==='all'?'Все':f==='in'?'Входящие':'Исходящие'}</Button>)}</div>
                    {transfers.length===0 ? <p className="text-xs text-[var(--color-text-muted)]">Нет переводов</p> :
                    <div className="space-y-2">{transfers.map((t:any)=>{const out=t.fromUserId===user?.id;return<div key={t.id} className="border-b border-[var(--color-border-light)] pb-2 text-xs"><div className="flex items-center gap-1"><span className={out?'text-[var(--color-accent-danger)]':'text-[var(--color-accent-success)]'}>{out?'→':'←'} {formatMoney(out?t.amount:t.received)}</span><span className="text-[var(--color-text-muted)]">{out?`на ${t.toAccount}`:`от ${t.fromAccount}`}</span><span className="ml-auto text-[var(--color-text-muted)]">{fmtSafeDate(t.createdAt)}</span></div><div className="text-[var(--color-text-muted)]">{out?`Кому: ${t.toUsername}`:`От: счёт ${t.fromAccount}`}{t.commission>0&&out?`, ком. ${t.commission}`:''}</div></div>})}</div>}
                </Card>
            </>}
        </div>
    );
}
