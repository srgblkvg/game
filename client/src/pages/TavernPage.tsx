import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

export default function TavernPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [tavern, setTavern] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'heal' | 'room' | 'drink'>('heal');

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

    const load = async () => {
        try {
            const res = await fetch(`${BASE_URL}/tavern`, { headers: getHeaders() });
            setTavern(await res.json());
        } catch (e: any) { setError(e.message); }
    };

    const api = async (url: string, body?: any) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST', headers: getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    };

    const handleHeal = async (full: boolean) => {
        try { await api('/tavern/heal', { full }); setMessage(full ? 'Полное исцеление!' : 'Частичное исцеление!'); load(); }
        catch (e: any) { setError(e.message); }
    };

    const handleRent = async (roomType: string, hours: number) => {
        try { const r = await api('/tavern/room', { roomType, hours }); setMessage(`Арендована комната «${tavern.rooms.find((x: any) => x.key === r.room.type)?.name}» на ${hours} ч`); load(); }
        catch (e: any) { setError(e.message); }
    };

    const handleDrink = async (drinkType: string) => {
        try { const r = await api('/tavern/drink', { drinkType }); setMessage(`Выпито: ${tavern.drinks.find((x: any) => x.key === r.drink.type)?.name}`); load(); }
        catch (e: any) { setError(e.message); }
    };

    if (!tavern) return <div className="p-4">Загрузка...</div>;

    const missingHp = tavern.maxHp - tavern.currentHp;

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:drink-me" width="22" height="22" className="inline mr-2" />Трактир «Гнилая Кровь»</h1>
            <p className="text-xs text-[var(--color-text-muted)] italic mb-4">
                «Заходи, путник. Раны залечим, нальём чего покрепче.»
            </p>

            {/* Статус */}
            <Card className="mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)]">HP: {tavern.currentHp}/{tavern.maxHp}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">🥇 {formatMoney(tavern.money)}</p>
                    </div>
                    <div className="text-xs text-right">
                        {tavern.room && <p className="text-[var(--color-accent-success)]">🛏 {tavern.room.type === 'chamber' ? 'Покой' : tavern.room.type === 'bed' ? 'Койка' : 'Чулан'}</p>}
                        {tavern.drink && <p className="text-[var(--color-accent-purple)]">⚗ {tavern.drinks.find((d: any) => d.key === tavern.drink.type)?.name}</p>}
                    </div>
                </div>
            </Card>

            {/* Табы */}
            <div className="flex gap-2 mb-4">
                {(['heal', 'room', 'drink'] as const).map(t => (
                    <Button key={t} variant={tab === t ? 'primary' : 'secondary'} size="xs" onClick={() => setTab(t)}>
                        {t === 'heal' ? '🏥 Лечение' : t === 'room' ? '🛏 Комнаты' : '⚗ Напитки'}
                    </Button>
                ))}
            </div>

            {message && <p className="mb-4 text-sm text-[var(--color-accent-success)]">{message}</p>}
            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            {tab === 'heal' && (
                <Card>
                    <h3 className="font-bold mb-2">Лечение</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mb-3">Недостаёт HP: {missingHp}</p>
                    <div className="flex gap-3">
                        <Button variant="danger" fullWidth onClick={() => handleHeal(false)} disabled={missingHp <= 0}>
                            Лечить 50% ({Math.ceil(missingHp * 0.5) * 2} 🥇)
                        </Button>
                        <Button variant="danger" fullWidth onClick={() => handleHeal(true)} disabled={missingHp <= 0}>
                            Лечить всё ({missingHp * 2} 🥇)
                        </Button>
                    </div>
                </Card>
            )}

            {tab === 'room' && (
                <div className="space-y-3">
                    {tavern.rooms.map((room: any) => (
                        <Card key={room.key}>
                            <h3 className="font-bold">{room.name}</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mb-2">Реген: ×{room.rate}</p>
                            <div className="flex gap-2">
                                <Button variant="primary" size="sm" onClick={() => handleRent(room.key, 1)}>
                                    1 ч — {formatMoney(room.cost1h)}
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => handleRent(room.key, 8)}>
                                    8 ч — {formatMoney(room.cost8h)}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {tab === 'drink' && (
                <div className="space-y-3">
                    {tavern.drinks.map((drink: any) => (
                        <Card key={drink.key}>
                            <h3 className="font-bold text-sm">{drink.name}</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">
                                {Object.entries(drink.bonuses).map(([k, v]) => `${k === 's' ? 'Сил' : k === 'a' ? 'Лвк' : k === 'd' ? 'Защ' : 'Мст'} +${v}`).join(', ')} (1 час)
                            </p>
                            <Button variant="danger" size="xs" onClick={() => handleDrink(drink.key)}>
                                {formatMoney(drink.cost)} 🥇
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
