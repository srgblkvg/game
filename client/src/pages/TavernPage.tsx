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
import { formatMoney } from '../utils/money';

const statNames: Record<string, string> = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };

function formatTime(seconds: number) {
    if (seconds <= 0) return 'истекло';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export default function TavernPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();

    const [tavern, setTavern] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'heal' | 'room' | 'drink'>('heal');
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);
    useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

    const load = async () => {
        try {
            const res = await fetch(`${BASE_URL}/tavern`, { headers: getHeaders() });
            setTavern(await res.json());
            const fresh = await fetchCharacter(); setCharacter(fresh);
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
        try { await api('/tavern/room', { roomType, hours }); setMessage('Комната арендована!'); load(); }
        catch (e: any) { setError(e.message); }
    };

    const handleDrink = async (drinkType: string) => {
        try { await api('/tavern/drink', { drinkType }); setMessage('Напиток выпит!'); load(); }
        catch (e: any) { setError(e.message); }
    };

    if (!tavern) return <div className="p-4">Загрузка...</div>;

    const missingHp = Math.max(0, (character?.stats?.hp || tavern.maxHp) - tavern.currentHp);

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:drink-me" width="22" height="22" className="inline mr-2" />Трактир «Гнилая Кровь»</h1>
            <p className="text-xs text-[var(--color-text-muted)] italic mb-4">
                «Заходи, путник. Раны залечим, нальём чего покрепче.»
            </p>

            <Card className="mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)]">HP: {tavern.currentHp}/{character?.stats?.hp || tavern.maxHp}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{formatMoney(tavern.money)}</p>
                    </div>
                    <div className="text-xs text-right">
                        {tavern.room && tavern.room.until > now && (
                            <p className="text-[var(--color-accent-success)]">Комната: {tavern.room.type === 'chamber' ? 'Покой' : tavern.room.type === 'bed' ? 'Койка' : 'Чулан'} ({formatTime(tavern.room.until - now)})</p>
                        )}
                        {tavern.drink && tavern.drink.until > now && (
                            <p className="text-[var(--color-accent-purple)]">Напиток: {tavern.drinks.find((d: any) => d.key === tavern.drink.type)?.name} ({formatTime(tavern.drink.until - now)})</p>
                        )}
                    </div>
                </div>
            </Card>

            <div className="flex gap-2 mb-4">
                {(['heal', 'room', 'drink'] as const).map(t => (
                    <Button key={t} variant={tab === t ? 'primary' : 'secondary'} size="xs" onClick={() => setTab(t)}>
                        {t === 'heal' ? 'Лечение' : t === 'room' ? 'Комнаты' : 'Напитки'}
                    </Button>
                ))}
            </div>

            {message && <p className="mb-4 text-sm text-[var(--color-accent-success)]">{message}</p>}
            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            {tab === 'heal' && (
                <Card>
                    <h3 className="font-bold mb-2">Мгновенное лечение</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mb-3">Недостаёт HP: {missingHp} (2 монеты за HP)</p>
                    <div className="flex gap-3">
                        <Button variant="danger" fullWidth onClick={() => handleHeal(false)} disabled={missingHp <= 0}>
                            50% — {formatMoney(Math.ceil(missingHp * 0.5) * 2)}
                        </Button>
                        <Button variant="danger" fullWidth onClick={() => handleHeal(true)} disabled={missingHp <= 0}>
                            Всё — {formatMoney(missingHp * 2)}
                        </Button>
                    </div>
                </Card>
            )}

            {tab === 'room' && (
                <div className="space-y-3">
                    {tavern.rooms.map((room: any) => (
                        <Card key={room.key}>
                            <h3 className="font-bold">{room.name}</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mb-2">Регенерация: ×{room.rate} (базовая: 1 HP/10 сек)</p>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tavern.drinks.map((drink: any) => (
                        <Card key={drink.key} className="flex flex-col">
                            <div className="w-full h-20 bg-[var(--color-bg-input)] rounded mb-2 flex items-center justify-center text-[var(--color-text-muted)] text-2xl">
                                <Icon icon="game-icons:potion-ball" width="32" height="32" />
                            </div>
                            <h3 className="font-bold text-xs mb-1">{drink.name}</h3>
                            <div className="text-[0.65rem] text-[var(--color-text-muted)] mb-2 flex-1">
                                {Object.entries(drink.bonuses).map(([k, v]) => (
                                    <span key={k} className="block">{statNames[k] || k}: +{v}</span>
                                ))}
                                <span className="block text-[var(--color-text-muted)]">1 час</span>
                            </div>
                            <div className="mt-auto">
                                <Button variant="danger" size="xs" fullWidth onClick={() => handleDrink(drink.key)}>
                                    {formatMoney(drink.cost)}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
