import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAcquire } from '../contexts/AcquireContext';
import { useServerTime } from '../contexts/ServerTimeContext';
import { fetchCharacter } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

const statNames: Record<string, string> = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };

function formatTime(seconds: number) {
    if (seconds <= 0) return 'истекло';
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export default function TavernPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showAcquire } = useAcquire();
    const { now } = useServerTime();

    const [tavern, setTavern] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'heal' | 'room' | 'drink' | 'quests'>(() => {
        const t = searchParams.get('tab'); if (t === 'room' || t === 'drink' || t === 'quests') return t; return 'heal';
    });
    const [quests, setQuests] = useState<any>(null);

    useEffect(() => { if (!user) navigate('/login'); else { load(); loadQuests(); } }, [user]);

    const load = async () => {
        try { const r = await fetch(`${BASE_URL}/tavern`,{headers:getHeaders()}); setTavern(await r.json()); setCharacter(await fetchCharacter()); } catch(e:any){setError(e.message)}
    };
    const loadQuests = async () => {
        try { setQuests(await (await fetch(`${BASE_URL}/tavern/quests`,{headers:getHeaders()})).json()); } catch(e:any){ console.error('loadQuests failed:', e); }
    };
    const api = async (url: string, body?: any) => {
        const r = await fetch(`${BASE_URL}${url}`,{method:body?'POST':'GET',headers:getHeaders(),body:body?JSON.stringify(body):undefined});
        const d = await r.json(); if(!r.ok) throw new Error(d.error); return d;
    };

    const handleHeal = async (full: boolean) => {
        try { await api('/tavern/heal',{full}); showAcquire({name:full?'Полное исцеление':'Частичное исцеление',rarity_id:2},1,'Вылечено'); setMessage(''); load(); } catch(e:any){setError(e.message)}
    };
    const handleRent = async (roomType: string, hours: number) => {
        try { const d = await api('/tavern/room',{roomType,hours}); showAcquire({name:d.room.name,rarity_id:3},1,`Аренда на ${hours}ч`); setMessage(''); load(); } catch(e:any){setError(e.message)}
    };
    const handleDrink = async (drinkType: string) => {
        try { const d = await api('/tavern/drink',{drinkType}); showAcquire({name:d.drink.name,rarity_id:3},1,'Выпито'); setMessage(''); load(); } catch(e:any){setError(e.message)}
    };
    const handleTakeQuest = async (questId: number) => {
        try { await api('/tavern/quests/take',{questId}); setMessage('Квест взят!'); setError(''); loadQuests(); } catch(e:any){setError(e.message)}
    };
    const handleClaimQuest = async (questId: number) => {
        try { const d = await api('/tavern/quests/claim',{questId}); setMessage(`Награда: +${d.rewardXp} XP, +${formatMoney(d.rewardMoney)}`); setError(''); showAcquire({name:'Квест выполнен!',rarity_id:3},1,`+${d.rewardXp} XP, ${formatMoney(d.rewardMoney)}`); loadQuests(); load(); } catch(e:any){setError(e.message)}
    };

    if (!tavern) return <div className="p-4">Загрузка...</div>;
    const missingHp = Math.max(0, (character?.stats?.hp || tavern.maxHp) - tavern.currentHp);

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:drink-me" width="22" height="22" className="inline mr-2" />Трактир «Гнилая Кровь»</h1>
            <Card className="mb-4"><div className="flex justify-between items-center"><div><p className="text-xs text-[var(--color-text-muted)]">HP: {tavern.currentHp}/{character?.stats?.hp || tavern.maxHp}</p><p className="text-xs text-[var(--color-text-muted)]">{tavern.money != null ? formatMoney(tavern.money) : '...'}</p></div><div className="text-xs text-right">{tavern.room && tavern.room.until > now && <p className="text-[var(--color-accent-success)]">Комната: {tavern.room.type==='chamber'?'Покой':tavern.room.type==='bed'?'Койка':'Чулан'} ({formatTime(tavern.room.until-now)})</p>}{tavern.drink && tavern.drink.until > now && <p className="text-[var(--color-accent-purple)]">Напиток: {tavern.drinks.find((d:any)=>d.key===tavern.drink.type)?.name} ({formatTime(tavern.drink.until-now)})</p>}</div></div></Card>

            <div className="flex gap-2 mb-4">{(['heal','room','drink','quests'] as const).map(t => <Button key={t} variant={tab===t?'primary':'secondary'} size="xs" onClick={()=>setTab(t)}>{t==='heal'?'Лечение':t==='room'?'Комнаты':t==='drink'?'Напитки':'Задания'}</Button>)}</div>
            {message && <p className="mb-4 text-sm text-[var(--color-accent-success)]">{message}</p>}
            {error && <p className="mb-4 text-sm text-[var(--color-accent-danger)]">{error}</p>}

            {tab==='heal' && <Card><h3 className="font-bold mb-2">Мгновенное лечение</h3><p className="text-xs text-[var(--color-text-muted)] mb-3">Недостаёт HP: {missingHp} (2 монеты за HP)</p><div className="flex gap-3"><Button variant="danger" fullWidth onClick={()=>handleHeal(false)} disabled={missingHp<=0}>50% — {formatMoney(Math.ceil(missingHp*0.5)*2)}</Button><Button variant="danger" fullWidth onClick={()=>handleHeal(true)} disabled={missingHp<=0}>Всё — {formatMoney(missingHp*2)}</Button></div></Card>}
            {tab==='room' && <div className="space-y-3">{tavern.rooms.map((room:any)=><Card key={room.key}><h3 className="font-bold">{room.name}</h3><p className="text-xs text-[var(--color-text-muted)] mb-2">Регенерация: ×{room.rate}</p><div className="flex gap-2"><Button variant="primary" size="sm" onClick={()=>handleRent(room.key,1)}>1 ч — {formatMoney(room.cost1h)}</Button><Button variant="secondary" size="sm" onClick={()=>handleRent(room.key,8)}>8 ч — {formatMoney(room.cost8h)}</Button></div></Card>)}</div>}
            {tab==='drink' && <><p className="text-xs text-[var(--color-accent-warning)] bg-[var(--color-accent-warning)]/10 border border-[var(--color-accent-warning)]/20 rounded p-2 mb-3">⚠️ Можно находиться под действием только одного напитка.</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{tavern.drinks.map((drink:any)=><Card key={drink.key} className="flex flex-col"><div className="w-full h-20 bg-[var(--color-bg-input)] rounded mb-2 flex items-center justify-center text-2xl"><Icon icon="game-icons:potion-ball" width="32" height="32"/></div><h3 className="font-bold text-xs mb-1">{drink.name}</h3><div className="text-[0.65rem] text-[var(--color-text-muted)] mb-2 flex-1">{Object.entries(drink.bonuses as Record<string,number>).map(([k,v])=><span key={k} className="block">{statNames[k]||k}: +{v}</span>)}<span className="block">1 час</span></div><Button variant="danger" size="xs" fullWidth onClick={()=>handleDrink(drink.key)}>{formatMoney(drink.cost)}</Button></Card>)}</div></>}

            {tab==='quests' && quests && <>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    Активно: {quests.activeCount}/3 • Доступно сегодня: {quests.dailyLimit - quests.activeCount - quests.completedToday}/{quests.dailyLimit}
                    {quests.resetAt && (
                        <span className="ml-2 text-[var(--color-accent-info)]">
                            (сброс через {formatTime(Math.max(0, quests.resetAt - now))})
                        </span>
                    )}
                </p>
                <div className="space-y-3">
                    {quests.quests.map((q: any) => (
                        <Card key={q.id} className={q.status==='active'?'border-[var(--color-accent-info)]':''}>
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-sm">{q.typeIcon} {q.typeName}</h3>
                                <span className="text-xs text-[var(--color-text-muted)]">{q.difficultyLabel}</span>
                            </div>
                            <p className="text-xs mb-1">{q.description}</p>
                            <div className="flex items-center gap-2 text-xs mb-2">
                                {q.status==='active' && <span className="text-[var(--color-accent-info)]">{q.progress}/{q.requirement}</span>}
                                {q.status==='claimed' && <span className="text-[var(--color-accent-success)]">✓ Выполнено</span>}
                                <span className="text-[var(--color-text-muted)]">Награда: +{q.rewardXp} XP, {formatMoney(q.rewardMoney)}</span>
                            </div>
                            <div className="flex gap-2">
                                {q.status==='available' && quests.canTake && <Button variant="primary" size="xs" onClick={()=>handleTakeQuest(q.id)}>Взять</Button>}
                                {q.status==='active' && q.progress >= q.requirement && <Button variant="danger" size="xs" onClick={()=>handleClaimQuest(q.id)}>Сдать</Button>}
                            </div>
                        </Card>
                    ))}
                </div>
            </>}
        </div>
    );
}
