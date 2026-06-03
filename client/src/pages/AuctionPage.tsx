import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import { formatMoney } from '../utils/money';

export default function AuctionPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();

    const [lots, setLots] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'buy' | 'sell'>('buy');

    // Sell form
    const [sellItemId, setSellItemId] = useState('');
    const [startPrice, setStartPrice] = useState('');
    const [buyoutPrice, setBuyoutPrice] = useState('');
    const [duration, setDuration] = useState(24);

    // Bid
    const [bidAmount, setBidAmount] = useState<Record<number, string>>({});

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

    const load = async () => {
        try { const res = await fetch(`${BASE_URL}/auction`, { headers: getHeaders() }); setLots(await res.json()); }
        catch (e: any) { setError(e.message); }
    };

    const api = async (url: string, body?: any) => {
        const res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    };

    const handleSell = async () => {
        const item = character?.inventory.find((i: any) => i.id === sellItemId);
        if (!item) { setError('Выберите предмет'); return; }
        try {
            await api('/auction/sell', {
                itemData: item,
                startPrice: parseInt(startPrice),
                buyoutPrice: buyoutPrice ? parseInt(buyoutPrice) : null,
                duration,
            });
            const fresh = await fetchCharacter(); setCharacter(fresh);
            setMessage('Лот выставлен!'); load();
        } catch (e: any) { setError(e.message); }
    };

    const handleBid = async (lotId: number, amount: string) => {
        try { await api('/auction/bid', { lotId, amount: parseInt(amount) }); setMessage('Ставка сделана!'); load(); const fresh = await fetchCharacter(); setCharacter(fresh); }
        catch (e: any) { setError(e.message); }
    };

    const handleBuyout = async (lotId: number) => {
        try { await api('/auction/buyout', { lotId }); setMessage('Куплено!'); load(); const fresh = await fetchCharacter(); setCharacter(fresh); }
        catch (e: any) { setError(e.message); }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:auction" width="22" height="22" className="inline mr-2" />Некропольный Торг</h1>

            <div className="flex gap-2 mb-4">
                <Button variant={tab === 'buy' ? 'primary' : 'secondary'} size="xs" onClick={() => setTab('buy')}>Покупка</Button>
                <Button variant={tab === 'sell' ? 'primary' : 'secondary'} size="xs" onClick={() => setTab('sell')}>Продажа</Button>
            </div>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            {tab === 'sell' && (
                <Card className="mb-4">
                    <h3 className="font-bold mb-2">Выставить лот</h3>
                    <select value={sellItemId} onChange={e => setSellItemId(e.target.value)} className={inputClass}>
                        <option value="">— Выберите предмет —</option>
                        {character?.inventory.filter((i: any) => !i.type || (i.type !== 'material' && i.type !== 'craft_item')).map((item: any) => (
                            <option key={item.id} value={item.id}>{item.name} ({item.rarity_display || '?'})</option>
                        ))}
                    </select>
                    <input type="number" placeholder="Стартовая цена" value={startPrice} onChange={e => setStartPrice(e.target.value)} className={inputClass} />
                    <input type="number" placeholder="Выкуп (необязательно)" value={buyoutPrice} onChange={e => setBuyoutPrice(e.target.value)} className={inputClass} />
                    <select value={duration} onChange={e => setDuration(+e.target.value)} className={inputClass}>
                        <option value={6}>6 часов</option>
                        <option value={12}>12 часов</option>
                        <option value={24}>24 часа</option>
                        <option value={48}>48 часов</option>
                    </select>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">Комиссия 5% от стартовой цены</p>
                    <Button variant="danger" size="sm" onClick={handleSell}>Выставить (5% комиссия)</Button>
                </Card>
            )}

            {tab === 'buy' && lots.map((lot: any) => {
                const item = lot.itemData;
                return (
                    <Card key={lot.id} className="mb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-sm">{item.name}</h3>
                                <p className="text-xs text-[var(--color-text-muted)]">{item.rarity_display} • {lot.sellerName}</p>
                                <p className="text-xs">Старт: {formatMoney(lot.startPrice)} {lot.currentBid && <>• Ставка: {formatMoney(lot.currentBid)}</>}</p>
                                {lot.buyoutPrice && <p className="text-xs">Выкуп: {formatMoney(lot.buyoutPrice)}</p>}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">{Math.max(0, Math.ceil((lot.endsAt - Date.now()/1000)/3600))}ч</div>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <input type="number" placeholder="Ставка" value={bidAmount[lot.id] || ''} onChange={e => setBidAmount({ ...bidAmount, [lot.id]: e.target.value })} className={inputClass + ' w-24'} />
                            <Button variant="primary" size="xs" onClick={() => handleBid(lot.id, bidAmount[lot.id] || '0')}>Ставка</Button>
                            {lot.buyoutPrice && <Button variant="danger" size="xs" onClick={() => handleBuyout(lot.id)}>Выкуп</Button>}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
