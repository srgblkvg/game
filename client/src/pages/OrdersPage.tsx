import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import { formatMoney } from '../utils/money';

export default function OrdersPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();

    const [allOrders, setAllOrders] = useState<any[]>([]);
    const [myOrder, setMyOrder] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'my' | 'all'>('all');

    // Forms
    const [orderName, setOrderName] = useState('');
    const [donateAmount, setDonateAmount] = useState('');

    useEffect(() => { if (!user) navigate('/login'); else loadAll(); }, [user]);

    const loadAll = async () => {
        try {
            const res = await fetch(`${BASE_URL}/orders`, { headers: getHeaders() });
            setAllOrders(await res.json());
        } catch (e: any) { setError(e.message); }
    };

    const loadMy = async () => {
        try {
            const res = await fetch(`${BASE_URL}/orders/my`, { headers: getHeaders() });
            setMyOrder((await res.json()).order);
        } catch (e: any) { setError(e.message); }
    };

    useEffect(() => { if (tab === 'my') loadMy(); }, [tab]);

    const api = async (url: string, body?: any) => {
        const res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    };

    const handleCreate = async () => {
        try { await api('/orders/create', { name: orderName }); setMessage('Гильдия создана!'); loadAll(); loadMy(); const f = await fetchCharacter(); setCharacter(f); }
        catch (e: any) { setError(e.message); }
    };

    const handleJoin = async (orderId: number) => {
        try { await api('/orders/join', { orderId }); setMessage('Вы вступили в гильдию!'); loadAll(); loadMy(); }
        catch (e: any) { setError(e.message); }
    };

    const handleLeave = async () => {
        try { await api('/orders/leave'); setMessage('Вы покинули гильдию'); loadAll(); setMyOrder(null); }
        catch (e: any) { setError(e.message); }
    };

    const handleDonate = async () => {
        try { await api('/orders/donate', { amount: parseInt(donateAmount) }); setMessage('Пожертвовано!'); loadMy(); const f = await fetchCharacter(); setCharacter(f); }
        catch (e: any) { setError(e.message); }
    };

    const handleKick = async (targetUserId: number) => {
        try { await api('/orders/kick', { targetUserId }); setMessage('Исключён'); loadMy(); }
        catch (e: any) { setError(e.message); }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Гильдии</h1>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            <div className="flex gap-2 mb-4">
                <Button variant={tab === 'all' ? 'primary' : 'secondary'} size="xs" onClick={() => setTab('all')}>Все гильдии</Button>
                <Button variant={tab === 'my' ? 'primary' : 'secondary'} size="xs" onClick={() => setTab('my')}>Моя гильдия</Button>
            </div>

            {tab === 'all' && (
                <div>
                    {!myOrder && character && character.level >= 5 && character.money >= 5000 && (
                        <Card className="mb-4">
                            <h3 className="font-bold mb-2">Создать гильдию (5000 серебра)</h3>
                            <div className="flex gap-2">
                                <input placeholder="Название" value={orderName} onChange={e => setOrderName(e.target.value)} className={inputClass} />
                                <Button variant="danger" size="sm" onClick={handleCreate}>Создать</Button>
                            </div>
                        </Card>
                    )}

                    {allOrders.map((o: any) => (
                        <Card key={o.id} className="mb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold">{o.name}</h3>
                                    <p className="text-xs text-[var(--color-text-muted)]">Ур. {o.level} • {o.memberCount} участников • {formatMoney(o.treasury)}</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">Магистр: {o.masterName}</p>
                                </div>
                                {!myOrder && <Button variant="primary" size="xs" onClick={() => handleJoin(o.id)}>Вступить</Button>}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {tab === 'my' && myOrder && (
                <div>
                    <Card className="mb-4">
                        <h2 className="text-lg font-bold mb-2">{myOrder.name}</h2>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <p>Уровень: <strong>{myOrder.level}</strong></p>
                            <p>Опыт: <strong>{myOrder.exp}</strong></p>
                            <p>Казна: <strong>{formatMoney(myOrder.treasury)}</strong></p>
                            <p>Налог: <strong>{myOrder.taxRate}%</strong></p>
                            <p>Магистр: <strong>{myOrder.masterName}</strong></p>
                            <p>Участников: <strong>{myOrder.members?.length || 0}</strong></p>
                        </div>

                        <div className="flex gap-2 mb-3">
                            <input type="number" placeholder="Сумма" value={donateAmount} onChange={e => setDonateAmount(e.target.value)} className={inputClass + ' w-24'} />
                            <Button variant="primary" size="xs" onClick={handleDonate}>Пожертвовать</Button>
                        </div>

                        {myOrder.members?.find((m: any) => m.userId === user?.id)?.rank !== 'master' && (
                            <Button variant="danger" size="xs" onClick={handleLeave}>Покинуть гильдию</Button>
                        )}
                    </Card>

                    <Card>
                        <h3 className="font-bold mb-2">Состав</h3>
                        {myOrder.members?.map((m: any) => (
                            <div key={m.userId} className="flex justify-between items-center py-1 border-b border-[var(--color-border-light)] text-sm">
                                <span>{m.username} <span className="text-xs text-[var(--color-text-muted)]">({m.rank === 'master' ? '👑' : m.rank === 'officer' ? '🗡' : m.rank === 'veteran' ? '⚔' : m.rank === 'fighter' ? '💀' : '🕯'} {m.rank === 'master' ? 'Магистр' : m.rank === 'officer' ? 'Офицер' : m.rank === 'veteran' ? 'Ветеран' : m.rank === 'fighter' ? 'Боец' : 'Рекрут'})</span></span>
                                {m.userId !== user?.id && myOrder.members?.find((x: any) => x.userId === user?.id)?.rank === 'master' && (
                                    <Button variant="secondary" size="xs" onClick={() => handleKick(m.userId)}>Искл.</Button>
                                )}
                            </div>
                        ))}
                    </Card>
                </div>
            )}
        </div>
    );
}
