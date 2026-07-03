import PageHeader from '../components/ui/PageHeader';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';

const TABS = ['🏚️ Обзор', '🏘️ Постройки', '💰 Казна', '👥 Участники'];
const PERIODS = ['today','week','month','all'] as const;
const PLABELS: Record<string,string> = {today:'Сегодня',week:'Неделя',month:'Месяц',all:'Всё'};

export default function GuildPage() {
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/guild'); if (c) setActionCard(c); }).catch(() => {}); }, []);
    const { user } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [guild, setGuild] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [guildList, setGuildList] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [tab, setTab] = useState(0);

    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [createJoinType, setCreateJoinType] = useState<'open'|'request'|'invite'>('open');
    const [inviteName, setInviteName] = useState('');
    const [inviteSuggestions, setInviteSuggestions] = useState<any[]>([]);
    const [inviteTargetId, setInviteTargetId] = useState<number|null>(null);
    const [treasuryAmount, setTreasuryAmount] = useState('');
    const [treasuryHistory, setTreasuryHistory] = useState<any[]>([]);
    const [treasuryBalance, setTreasuryBalance] = useState(0);
    const [taxRate, setTaxRate] = useState(0);
    const [taxRateInput, setTaxRateInput] = useState('');
    const [treasurySubtab, setTreasurySubtab] = useState<'deposit'|'tax'|'history'>('deposit');
    const [treasuryPeriod, setTreasuryPeriod] = useState('week');
    const [war, setWar] = useState<any>(null);
    const [showWarRules, setShowWarRules] = useState(false);
    const [confirmPopup, setConfirmPopup] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const api = async (url: string, body?: any) => {
        const r = await fetch(`${BASE_URL}${url}`, { method: body ? 'POST' : 'GET', headers: { ...getHeaders(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
    };
    const msg = (m: string) => { setMessage(m); setTimeout(() => setMessage(''), 3000); };

    const load = async () => {
        try {
            const [data, list] = await Promise.all([
                fetch(`${BASE_URL}/guild/my`, { headers: getHeaders() }).then(r => r.json()),
                fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() }).then(r => r.json()),
            ]);
            if (data.guild) { setGuild(data.guild); setMembers(data.members); setTreasuryBalance(data.guild.treasury||0); setTaxRate(data.guild.taxRate||0); setWar(data.war||null);
                if (data.guild.myRank==='leader'||data.guild.myRank==='officer') fetch(`${BASE_URL}/guild/requests`,{headers:getHeaders()}).then(r=>r.json()).then(setRequests).catch(()=>{});
            } else { setGuild(null); setMembers([]); }
            setGuildList(list);
        } catch (e: any) { setError(e.message); }
    };
    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

    const loadTreasury = async (period: string) => {
        setTreasuryPeriod(period);
        const r = await fetch(`${BASE_URL}/guild/treasury/history?period=${period}`, { headers: getHeaders() });
        const d = await r.json();
        if (r.ok) { setTreasuryBalance(d.treasury); setTreasuryHistory(d.contributions||[]); }
    };
    useEffect(() => { if (tab === 2) loadTreasury(treasuryPeriod); }, [tab]);

    const searchUsers = async (q: string) => {
        if (q.length < 2) { setInviteSuggestions([]); return; }
        fetch(`${BASE_URL}/users/search?q=${encodeURIComponent(q)}`,{headers:getHeaders()}).then(r=>r.json()).then(setInviteSuggestions).catch(()=>setInviteSuggestions([]));
    };

    const handleCreate = async () => {
        try { const d = await api('/guild/create',{name:createName,description:createDesc,joinType:createJoinType}); msg(`Гильдия «${d.name}» создана!`); setShowCreate(false); const f=await fetchCharacter(); setCharacter(f); load(); }
        catch (e: any) { setError(e.message); }
    };
    const handleJoin = async (gid: number, jt: string) => {
        try { await api(jt==='open'?`/guild/join/${gid}`:`/guild/request/${gid}`,{}); msg(jt==='open'?'Вступили!':'Заявка отправлена!'); const f=await fetchCharacter(); setCharacter(f); load(); }
        catch (e: any) { setError(e.message); }
    };
    const handleInvite = async () => {
        if (!inviteTargetId) { setError('Выберите игрока'); return; }
        try { await api('/guild/invite',{targetId:inviteTargetId}); msg('Приглашение отправлено!'); setInviteName(''); setInviteTargetId(null); }
        catch (e: any) { setError(e.message); }
    };
    const handleLeave = () => setConfirmPopup({ message:'Покинуть гильдию?', onConfirm: async () => { setConfirmPopup(null);
        try { await api('/guild/leave',{}); setGuild(null); const f=await fetchCharacter(); setCharacter(f); load(); } catch (e: any) { setError(e.message); }
    }});
    const handleRequest = async (id: number, accept: boolean) => {
        try { await api('/guild/handle-request',{requestId:id,accept}); msg(accept?'Принято':'Отклонено'); load(); } catch (e: any) { setError(e.message); }
    };
    const handleKick = (id: number, name: string) => setConfirmPopup({ message:`Исключить ${name}?`, onConfirm: async () => { setConfirmPopup(null);
        try { await api('/guild/kick',{targetId:id}); msg(`${name} исключён`); load(); } catch (e: any) { setError(e.message); }
    }});
    const handleRole = async (id: number, name: string, rank: string) => {
        try { await api('/guild/role',{targetId:id,rank}); msg(`${name} → ${rank==='officer'?'офицер':'боец'}`); load(); } catch (e: any) { setError(e.message); }
    };
    const handleCancelInvites = async () => {
        try { const d = await api('/guild/cancel-invites',{}); msg(`Отменено: ${d.cancelled}`); load(); } catch (e: any) { setError(e.message); }
    };
    const handleDeposit = async () => {
        const a = parseInt(treasuryAmount); if (!a||a<1) { setError('Укажите сумму'); return; }
        setLoading(true);
        try { const d = await api('/guild/treasury/deposit',{amount:a}); setTreasuryBalance(d.treasury); setTreasuryAmount(''); msg(`Внесено ${a}`); loadTreasury(treasuryPeriod); }
        catch (e: any) { setError(e.message); } finally { setLoading(false); }
    };
    const handleTaxRate = async () => {
        const r = parseInt(taxRateInput); if (isNaN(r)||r<0||r>50) { setError('0-50%'); return; }
        try { await api('/guild/tax-rate',{taxRate:r}); setTaxRate(r); setTaxRateInput(''); msg(`Налог: ${r}%`); } catch (e: any) { setError(e.message); }
    };

    // ── No guild ──
    if (!guild) {
        return (<div className="max-w-3xl mx-auto px-4 py-4"><BackButton /><h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Гильдии</h1>
          {actionCard && <PageHeader title="Гильдия" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
            {message && <p className="text-sm text-green-400 mb-3">{message}</p>}{error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <Button onClick={()=>setShowCreate(!showCreate)} className="mb-4">Создать гильдию</Button>
            {showCreate && (<Card className="mb-4"><input className={inputClass+' mb-2'} placeholder="Название" value={createName} onChange={e=>setCreateName(e.target.value)}/>
                <textarea className={inputClass+' mb-2'} placeholder="Описание" rows={2} value={createDesc} onChange={e=>setCreateDesc(e.target.value)}/>
                <select className={inputClass+' mb-2'} value={createJoinType} onChange={e=>setCreateJoinType(e.target.value as any)}>
                    <option value="open">Открытая</option><option value="request">По заявке</option><option value="invite">Закрытая</option></select>
                <Button onClick={handleCreate}>Создать (10000 серебра)</Button></Card>)}
            <h3 className="font-bold text-sm mb-2">Гильдии</h3>
            {guildList.map((g:any)=>(<Card key={g.id} className="mb-2"><div className="flex justify-between items-center">
                <div><h4 className="font-bold text-sm">{g.name}</h4><p className="text-xs text-[var(--color-text-muted)]">Ур.{g.level} • {g.memberCount} уч.</p></div>
                <Button size="md" onClick={()=>handleJoin(g.id,g.joinType)}>{g.joinType==='open'?'Вступить':'Заявка'}</Button></div></Card>))}
        </div>);
    }

    const myRank = guild.myRank;

    return (<div className="max-w-3xl mx-auto px-4 py-4"><BackButton /><h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Гильдии</h1>
          {actionCard && <PageHeader title="Гильдия" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
        {message && <p className="text-sm text-green-400 mb-3">{message}</p>}{error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {/* Header */}
        <Card className="mb-4"><div className="flex justify-between items-start"><div className="flex gap-3">
            {guild.image ? <img src={guild.image} alt="Герб" className="w-14 h-14 object-cover rounded border-2 border-[var(--color-accent-gold)]"/> :
                <div className="w-14 h-14 rounded border-2 border-dashed border-[var(--color-border-light)] flex items-center justify-center text-[0.5rem] text-[var(--color-text-muted)]">герб</div>}
            <div><h2 className="font-bold text-lg">🏚️ {guild.name}</h2><p className="text-xs text-[var(--color-text-muted)]">Ур.{guild.level} • {members.length} уч.</p>
                <ExpBar exp={guild.exp||0} level={guild.level||1}/></div></div>
            <div className="flex gap-1"><Button variant="secondary" size="md" onClick={()=>navigate('/guild/rating')}>Рейтинг</Button>
                <Button variant="secondary" size="md" onClick={handleLeave}>Покинуть</Button></div></div>
            {myRank==='leader' ? (<div className="mt-3 space-y-2"><div className="flex items-center gap-2">
                <label className="text-xs cursor-pointer text-[var(--color-accent-info)] hover:underline">{guild.image?'Сменить герб':'Загрузить герб'}
                    <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();
                        r.onload=()=>{const url=r.result as string;setGuild((p:any)=>p?{...p,image:url}:p);fetch('/api/guild/settings',{method:'POST',headers:{...getHeaders(),'Content-Type':'application/json'},body:JSON.stringify({image:url})}).catch(()=>{});};r.readAsDataURL(f);}}/></label></div>
                <textarea value={guild.description||''} onChange={e=>setGuild((p:any)=>p?{...p,description:e.target.value}:p)}
                    onBlur={async()=>{try{await fetch('/api/guild/settings',{method:'POST',headers:{...getHeaders(),'Content-Type':'application/json'},body:JSON.stringify({description:guild.description||''})});}catch{}}}
                    placeholder="Описание гильдии..." rows={2} className="w-full text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded px-2 py-1 text-[var(--color-text-primary)] resize-none"/>
                <div className="flex items-center gap-2"><span className="text-xs text-[var(--color-text-muted)]">Тип:</span>
                    <select value={guild.joinType||'open'} onChange={async e=>{const v=e.target.value;setGuild((p:any)=>p?{...p,joinType:v}:p);
                        try{await fetch('/api/guild/settings',{method:'POST',headers:{...getHeaders(),'Content-Type':'application/json'},body:JSON.stringify({joinType:v})});}catch{}}}
                        className="text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded px-1 py-0.5">
                        <option value="open">Открытая</option><option value="request">По заявкам</option><option value="invite">По приглашениям</option></select></div></div>
            ) : (guild.description && <p className="text-xs text-[var(--color-text-muted)] mt-2">{guild.description}</p>)}
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-[var(--color-bg-card)] rounded-lg p-1">{TABS.map((l,i)=>(
            <button key={i} onClick={()=>setTab(i)} className={`flex-1 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${tab===i?'bg-[var(--color-accent-info)] text-white':'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>{l}</button>))}
        </div>

        {/* Tab 0: Обзор */}
        {tab===0 && <div className="space-y-4">
            <GuildQuestCard guildId={guild.id} myRank={myRank} api={api}/>
            {war ? (<Card className="border-l-4 border-l-red-500"><h3 className="font-bold text-sm flex items-center gap-2 mb-2"><Icon icon="game-icons:crossed-swords" width="18" height="18"/>⚔️ Война</h3>
                <p className="text-xs">Противник: <b>{war.attackerGuild?.id===guild.id?war.defenderGuild?.name:war.attackerGuild?.name}</b></p>
                <p className="text-xs text-[var(--color-text-muted)]">{war.status==='pending'?'Ожидание ответа':war.status==='active'?'Активна':war.status}</p>
                {war.status==='active'&&<>
                    <p className="text-[0.65rem] mt-1 text-red-400">💰 Казна заморожена</p>
                    <Button size="md" variant="danger" className="mt-2" onClick={()=>navigate('/guild/war')}>⚔️ На поле боя</Button>
                </>}
                {myRank==='leader'&&war.attackerGuild?.id!==guild.id&&war.status==='pending'&&(<div className="flex gap-2 mt-2">
                    <Button size="md" onClick={async()=>{await api('/guild/war/respond',{accept:true});load();}}>Принять</Button>
                    <Button size="md" variant="secondary" onClick={async()=>{await api('/guild/war/respond',{accept:false});load();}}>Отклонить</Button></div>)}</Card>
            ) : (<Card><div className="flex items-center gap-2 cursor-pointer" onClick={()=>setShowWarRules(!showWarRules)}>
                <Icon icon={showWarRules?'game-icons:expand':'game-icons:contract'} width="14" height="14"/><h3 className="font-bold text-sm">⚔️ Война гильдий — правила</h3>
            </div>{showWarRules&&<div className="text-xs text-[var(--color-text-muted)] mt-2 space-y-1">
                <p>• Лидер объявляет войну через список гильдий</p><p>• 24 часа на ответ, 24 часа боёв</p><p>• Казна замораживается</p></div>}</Card>)}
        </div>}

        {/* Tab 1: Постройки */}
        {tab===1 && <Card><h3 className="font-bold text-sm mb-2">🏘️ Постройки гильдии</h3>
            {guild.buildings && guild.buildings.length>0 ? (<div className="space-y-3">
                {guild.buildings.map((b:any)=>(<div key={b.type} className="border border-[var(--color-border-light)] rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium">{b.icon} {b.label}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{b.level>0?`ур.${b.level} (+${b.bonus}%)`:'Не построено'}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">{b.desc}</p>
                    <div className="flex justify-between items-center text-[0.6rem] text-[var(--color-text-muted)] mb-2">
                        <span>След. уровень: +{b.nextBonus}%</span>
                        <span>Цена: {b.cost.toLocaleString()} серебра | Требуется ур. гильдии {b.reqLevel}</span>
                    </div>
                    {myRank==='leader'&&(
                        <Button size="md" disabled={!b.canBuild}
                            onClick={async()=>{try{await api('/guild/buildings/build',{buildingType:b.type});load();}catch(e:any){setError(e.message);}}}>
                            {b.level>0?'Улучшить':'Построить'}
                        </Button>
                    )}
                </div>))}
            </div>) : <p className="text-xs text-[var(--color-text-muted)]">Нет построек</p>}
        </Card>}

        {/* Tab 2: Казна */}
        {tab===2 && <Card><h3 className="font-bold text-sm">💰 Казна — {treasuryBalance.toLocaleString()} серебра{taxRate>0?` (налог ${taxRate}%)`:''}</h3>
            <div className="flex gap-1 my-2">{(['deposit','tax','history'] as const).map(t=>(
                <button key={t} onClick={()=>setTreasurySubtab(t)} className={`text-xs px-2 py-1 rounded cursor-pointer ${treasurySubtab===t?'bg-[var(--color-accent-info)] text-white':'bg-[var(--color-bg-input)]'}`}>
                    {{deposit:'Внести',tax:'Налог',history:'История'}[t]}</button>))}</div>
            {treasurySubtab==='deposit'&&<div className="flex gap-2"><input className={inputClass+' flex-1'} type="number" placeholder="Сумма" value={treasuryAmount} onChange={e=>setTreasuryAmount(e.target.value)}/>
                <Button size="md" onClick={handleDeposit} disabled={loading}>Внести</Button></div>}
            {treasurySubtab==='tax'&&myRank==='leader'&&<div className="flex gap-2"><input className={inputClass+' flex-1'} type="number" placeholder="0-50%" value={taxRateInput} onChange={e=>setTaxRateInput(e.target.value)}/>
                <Button size="md" onClick={handleTaxRate}>Установить</Button></div>}
            {treasurySubtab==='history'&&<div>
                <div className="flex gap-1 mb-2">{PERIODS.map(p=>(<button key={p} onClick={()=>loadTreasury(p)} className={`text-xs px-2 py-0.5 rounded cursor-pointer ${treasuryPeriod===p?'bg-[var(--color-accent-info)] text-white':'bg-[var(--color-bg-input)]'}`}>{PLABELS[p]}</button>))}</div>
                {treasuryHistory.length>0?<div className="text-xs space-y-1">{treasuryHistory.map((h:any,i:number)=>(<div key={i} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                    <span>{h.username} <span className="text-[var(--color-text-muted)]">({h.count} раз)</span></span><span className="text-green-400">+{h.total.toLocaleString()}</span></div>))}</div>
                :<p className="text-xs text-[var(--color-text-muted)]">Нет взносов</p>}</div>}
        </Card>}

        {/* Tab 3: Участники */}
        {tab===3 && <div className="space-y-4">
            {(myRank==='leader'||myRank==='officer')&&(<Card><h3 className="font-bold text-sm mb-2">Пригласить игрока</h3>
                <div className="flex gap-2 mb-2"><input className={inputClass+' flex-1'} placeholder="Имя игрока" value={inviteName} onChange={e=>{setInviteName(e.target.value);searchUsers(e.target.value);}}/>
                    <Button size="md" onClick={handleInvite} disabled={!inviteTargetId}>Пригласить</Button></div>
                {inviteSuggestions.length>0&&<div className="text-xs space-y-1 max-h-24 overflow-y-auto">{inviteSuggestions.map((s:any)=>(<div key={s.id} className={`p-1 cursor-pointer rounded ${inviteTargetId===s.id?'bg-[var(--color-accent-info)]':''}`}
                    onClick={()=>{setInviteTargetId(s.id);setInviteName(s.username);setInviteSuggestions([]);}}>{s.username} (ур.{s.level})</div>))}</div>}
                {requests.length>0&&<div className="mt-3"><h4 className="text-xs font-bold mb-1">Заявки ({requests.length})</h4>{requests.map((r:any)=>(<div key={r.id} className="flex justify-between py-1 text-xs"><span>{r.username}</span>
                    <div className="flex gap-1"><Button size="md" onClick={()=>handleRequest(r.id,true)}>✓</Button><Button size="md" variant="secondary" onClick={()=>handleRequest(r.id,false)}>✗</Button></div></div>))}</div>}
                {myRank==='leader'&&<div className="mt-2"><Button size="md" variant="secondary" onClick={handleCancelInvites}>Отменить приглашения</Button></div>}</Card>)}
            <Card><h3 className="font-bold text-sm mb-2">Участники ({members.length})</h3><div className="space-y-1">
                {members.map((m:any)=>(<div key={m.userId} className="flex justify-between items-center py-1 border-b border-[var(--color-border-light)] text-xs">
                    <span className="cursor-pointer hover:text-[var(--color-accent-info)]" onClick={()=>navigate(`/profile/${m.userId}`)}>
                        {m.rank==='leader'?'👑':m.rank==='officer'?'🛡️':'⚔️'} {m.username} <span className="text-[var(--color-text-muted)]">ур.{m.level}</span></span>
                    {myRank==='leader'&&m.rank!=='leader'&&<div className="flex gap-1">
                        <Button size="md" variant="secondary" onClick={()=>handleRole(m.userId,m.username,m.rank==='officer'?'member':'officer')}>{m.rank==='officer'?'Разжаловать':'Повысить'}</Button>
                        <Button size="md" variant="secondary" onClick={()=>handleKick(m.userId,m.username)}>Исключить</Button></div>}
                </div>))}</div></Card>
        </div>}

        {/* Popup */}
        {confirmPopup&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setConfirmPopup(null)}>
            <Card className="max-w-xs w-full" onClick={e=>e.stopPropagation()}><p className="text-sm mb-3">{confirmPopup.message}</p>
                <div className="flex gap-2 justify-end"><Button variant="secondary" size="md" onClick={()=>setConfirmPopup(null)}>Отмена</Button><Button size="md" onClick={confirmPopup.onConfirm}>OK</Button></div></Card></div>}
    </div>);
}

function ExpBar({exp,level}:{exp:number;level:number}){const n=100*Math.pow(2,level-1);return <div className="mt-1"><div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5"><span>Опыт</span><span>{exp}/{n}</span></div><div className="w-full h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden"><div className="h-full bg-[var(--color-accent-gold)] rounded-full transition-all" style={{width:`${Math.min(100,(exp/n)*100)}%`}}/></div></div>}

function GuildQuestCard({guildId:_guildId,myRank,api}:{guildId:number;myRank:string;api:any}){
    const [aq,setAq]=useState<any>(null);const [opts,setOpts]=useState<any[]|null>(null);const [m,setM]=useState('');const [l,setL]=useState(false);
    useEffect(()=>{load();const h=(e:any)=>{if(e.detail?.id)setAq(e.detail)};window.addEventListener('guildQuestProgress',h);return()=>window.removeEventListener('guildQuestProgress',h)},[]);
    const load=async()=>{const r=await fetch('/api/guild/quest',{headers:getHeaders()});const d=await r.json();setAq(d.activeQuest||null);setOpts(d.options||null)};
    const take=async(o:any)=>{setL(true);try{await api('/guild/quest/take',{questType:o.questType,difficulty:o.difficulty,requirement:o.requirement,rewardXp:o.rewardXp});load()}catch(e:any){setM(e.message)}setL(false)};
    const claim=async()=>{setL(true);try{const d=await api('/guild/quest/claim',{});setM(d.message||`+${d.rewardXp} XP!`);load()}catch(e:any){setM(e.message)}setL(false)};
    return <Card><h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Icon icon="game-icons:scroll-unfurled" width="16" height="16"/>Задание гильдии</h3>{m&&<p className="text-xs text-green-400 mb-2">{m}</p>}
        {aq?<><p className="text-xs font-medium">{aq.typeName} <span className="text-[0.6rem] text-[var(--color-text-muted)]">{aq.difficultyLabel}</span></p><p className="text-xs text-[var(--color-text-muted)] mb-2">{aq.description}</p>
            <div className="mb-1"><div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5"><span>{aq.progress}/{aq.requirement}</span><span>+{aq.rewardXp} XP</span></div>
            <div className="w-full h-1.5 bg-[var(--color-bg-input)] rounded-full"><div className="h-full bg-[var(--color-accent-info)] rounded-full" style={{width:`${Math.min(100,(aq.progress/aq.requirement)*100)}%`}}/></div></div>
            {myRank==='leader'&&aq.progress>=aq.requirement&&<Button variant="primary" size="md" onClick={claim} disabled={l} className="mt-2">Забрать</Button>}</>
        :opts?<><p className="text-xs text-[var(--color-text-muted)] mb-2">Выберите задание:</p><div className="space-y-2">{opts.map((o:any,i:number)=>(<div key={i} className="border border-[var(--color-border-light)] rounded-lg p-2">
            <div className="flex justify-between mb-1"><span className="text-xs font-medium">{o.typeName}</span><span className="text-[0.6rem] text-[var(--color-text-muted)]">{o.difficultyLabel}</span></div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{o.description}</p><div className="flex justify-between"><span className="text-[0.6rem] text-yellow-400">+{o.rewardXp} XP</span>
            {myRank==='leader'&&<Button variant="primary" size="md" onClick={()=>take(o)} disabled={l}>Взять</Button>}</div></div>))}</div>
            {myRank!=='leader'&&<p className="text-[0.6rem] text-[var(--color-text-muted)] mt-2">Ожидайте выбора лидера</p>}</>:null}</Card>;
}
