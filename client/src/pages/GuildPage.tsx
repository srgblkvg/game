import PageHeader from '../components/ui/PageHeader';
import { useState, useEffect, useRef } from 'react';
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
import { getLastSeen } from '../utils/time';

const TABS = ['🏚️ Обзор', '🏘️ Постройки', '💰 Казна', '👥 Участники', '👾 Босс', '🌟 Таланты'];
const PERIODS = ['today','week','month','all'] as const;
const PLABELS: Record<string,string> = {today:'Сегодня',week:'Неделя',month:'Месяц',all:'Всё'};

const TALENT_LABELS: Record<string,string> = {
  accuracy:'Меткость', fortitude:'Стойкость', penetration:'Пробивание', control:'Контроль', vampiric:'Антивампиризм',
};

export default function GuildPage() {
  const isVK = typeof document !== 'undefined' && document.documentElement.classList.contains('vk-iframe');
  const numType = isVK ? 'text' : 'number';
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/guild'); if (c) setActionCard(c); }).catch(() => {}); }, []);
    const { user } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [guild, setGuild] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [myPerms, setMyPerms] = useState({ quests: false, buildings: false, war: false });
    const [guildList, setGuildList] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [myRequests, setMyRequests] = useState<any[]>([]);
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
    const [warTimeLeft, setWarTimeLeft] = useState('');
    const [showWarRules, setShowWarRules] = useState(false);
    const [permPopup, setPermPopup] = useState<any>(null);
    const [confirmPopup, setConfirmPopup] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Boss state
    const [boss, setBoss] = useState<any>(null);
    const [bossCd, setBossCd] = useState(0);
    const [talentInfo, setTalentInfo] = useState<any[]>([]);
    const [playerPoints, setPlayerPoints] = useState(0);
    const [guildPoints, setGuildPoints] = useState(0);
    const [bossSteps, setBossSteps] = useState<any[]>([]);
    const [bossResult, setBossResult] = useState<any>(null);
    const [bossFighting, setBossFighting] = useState(false);
    const [battleHistory, setBattleHistory] = useState<any[]>([]);
    const [viewingLog, setViewingLog] = useState<any>(null);
    const [respawnTimer, setRespawnTimer] = useState(0);
    const [ratings, setRatings] = useState<any>(null);
    const bossTimerRef = useRef<any>(null);

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
                const me = data.members.find((m:any)=>m.userId===user?.id);
                if (me) setMyPerms({ quests: !!(me.can_quests||me.quests), buildings: !!(me.can_buildings||me.buildings), war: !!(me.can_war||me.war) });
                if (data.guild.myRank==='leader'||data.guild.myRank==='officer') fetch(`${BASE_URL}/guild/requests`,{headers:getHeaders()}).then(r=>r.json()).then(setRequests).catch(()=>{});
            } else { setGuild(null); setMembers([]);
                fetch(`${BASE_URL}/guild/my-requests`,{headers:getHeaders()}).then(r=>r.json()).then(setMyRequests).catch(()=>{});
            }
            setGuildList(list);
        } catch (e: any) { setError(e.message); }
    };
    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

    // Boss data
    const loadBoss = async () => {
        try {
            const [d, h, r] = await Promise.all([
                api('/guild/boss'),
                api('/guild/boss/battles'),
                api('/guild/boss/ratings'),
            ]);
            setBoss(d.boss);
            setBossCd(d.cooldownRemaining);
            setTalentInfo(d.talentInfo);
            setPlayerPoints(d.playerPoints);
            setGuildPoints(d.guildPoints);
            setBattleHistory(h.battles || []);
            setRatings(r);
        } catch {}
    };
    useEffect(() => { if (guild && (tab === 4 || tab === 5)) loadBoss(); }, [guild, tab]);

    // Boss cooldown timer
    useEffect(() => {
        if (bossCd <= 0) return;
        bossTimerRef.current = setInterval(() => setBossCd(p => Math.max(0, p - 1)), 1000);
        return () => { if (bossTimerRef.current) clearInterval(bossTimerRef.current); };
    }, [bossCd > 0]);

    // WS: обновление HP босса от других игроков
    useEffect(() => {
        const onUpdate = (e: Event) => {
            const msg = (e as CustomEvent).detail;
            const d = msg.data || msg;
            if (d.guildTalentPoints !== undefined) setGuildPoints(d.guildTalentPoints);
            if (d.bossKilled) {
                setBoss((p: any) => p ? { ...p, currentHp: 0, respawnAt: d.respawnAt } : p);
            } else {
                setBoss((p: any) => p ? { ...p, currentHp: d.bossHp } : p);
            }
        };
        window.addEventListener('guildBossUpdate', onUpdate);
        return () => window.removeEventListener('guildBossUpdate', onUpdate);
    }, []);

    const handleBossAttack = async () => {
        setBossFighting(true);
        setBossResult(null);
        setBossSteps([]);
        try {
            const d = await api('/guild/boss/attack', {});
            setBossSteps(d.steps || []);
            setBossResult(d);
            setPlayerPoints(p => p + 1);
            if (d.guildPointsGained) setGuildPoints(p => p + d.guildPointsGained);
            if (d.bossKilled && d.newBoss) {
                setBoss({ ...d.newBoss, currentHp: d.newBoss.maxHp, maxHp: d.newBoss.maxHp, atk: 80, agi: 50, def: 60, mst: 50 });
            } else {
                setBoss((p: any) => p ? { ...p, currentHp: d.bossHpAfter } : p);
            }
            setBossCd(3600);
        } catch (e: any) { setError(e.message); }
        setBossFighting(false);
    };

    const handleTalentUpgrade = async (talentType: string, scope: 'personal'|'guild') => {
        try {
            const d = await api('/guild/talents/upgrade', { talentType, scope });
            if (scope === 'personal') setPlayerPoints(d.remainingPoints);
            else setGuildPoints(d.remainingPoints);
            // Обновляем прогресс локально без перезагрузки
            setTalentInfo((prev: any[]) => prev.map((t: any) => {
                if (t.type !== talentType) return t;
                if (scope === 'personal') return { ...t, playerLevel: d.newLevel, playerProgress: d.newProgress };
                return { ...t, guildLevel: d.newLevel, guildProgress: d.newProgress };
            }));
            if (d.leveledUp) msg(`${TALENT_LABELS[talentType] || talentType} → ур.${d.newLevel}!`);
        } catch (e: any) { setError(e.message); }
    };

    // WS-обновление опыта и уровня гильдии
    useEffect(() => {
        const onExp = (e: Event) => {
            const d = (e as CustomEvent).detail;
            setGuild((prev: any) => prev ? { ...prev, exp: d.exp, level: d.level ?? prev.level } : prev);
        };
        const onLevelUp = (e: Event) => {
            const d = (e as CustomEvent).detail;
            setGuild((prev: any) => prev ? { ...prev, exp: d.exp, level: d.level } : prev);
        };
        window.addEventListener('guildExp', onExp);
        window.addEventListener('guildLevelUp', onLevelUp);
        return () => { window.removeEventListener('guildExp', onExp); window.removeEventListener('guildLevelUp', onLevelUp); };
    }, []);

    // Таймер войны
    useEffect(() => {
        if (!war?.expiresAt) { setWarTimeLeft(''); return; }
        const tick = () => {
            const now = Date.now();
            const end = new Date(war.expiresAt).getTime();
            const left = Math.max(0, Math.floor((end - now) / 1000));
            if (left <= 0) { setWarTimeLeft('Завершена'); return; }
            const h = Math.floor(left / 3600);
            const m = Math.floor((left % 3600) / 60);
            const s = left % 60;
            setWarTimeLeft(`${h}ч ${m}м ${s}с`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [war?.expiresAt]);

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
    const handleCancelRequest = async (id: number) => {
        try { await api(`/guild/cancel-request/${id}`,{}); msg('Заявка отменена'); load(); }
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
        try { const d = await api('/guild/treasury/deposit',{amount:a}); setTreasuryBalance(d.treasury); setTreasuryAmount(''); msg(`Внесено ${a}`); loadTreasury(treasuryPeriod); load(); }
        catch (e: any) { setError(e.message); } finally { setLoading(false); }
    };
    const handleTaxRate = async () => {
        const r = parseInt(taxRateInput); if (isNaN(r)||r<0||r>50) { setError('0-50%'); return; }
        try { await api('/guild/tax-rate',{taxRate:r}); setTaxRate(r); setTaxRateInput(''); msg(`Налог: ${r}%`); } catch (e: any) { setError(e.message); }
    };

    const fmtCd = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ── No guild ──
    if (!guild) {
        return (<div className="max-w-3xl mx-auto px-4 py-4"><BackButton />
          {actionCard && <PageHeader title="Гильдия" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
            {message && <p className="text-sm text-green-400 mb-3">{message}</p>}{error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <Button onClick={()=>setShowCreate(!showCreate)} className="mb-4">Создать гильдию</Button>
            {showCreate && (<Card className="mb-4"><input className={inputClass+' mb-2'} placeholder="Название" value={createName} onChange={e=>setCreateName(e.target.value)}/>
                <textarea className={inputClass+' mb-2'} placeholder="Описание" rows={2} value={createDesc} onChange={e=>setCreateDesc(e.target.value)}/>
                <select className={inputClass+' mb-2'} value={createJoinType} onChange={e=>setCreateJoinType(e.target.value as any)}>
                    <option value="open">Открытая</option><option value="request">По заявке</option><option value="invite">Закрытая</option></select>
                <Button onClick={handleCreate}>Создать (10000 серебра)</Button></Card>)}
            {myRequests.length > 0 && <Card className="mb-4 border-[var(--color-accent-warning)]/30">
                <h3 className="font-bold text-sm mb-2">📨 Ваши заявки</h3>
                {myRequests.map((r: any) => (
                    <div key={r.id} className="flex justify-between items-center py-1 text-xs border-b border-[var(--color-border-light)] last:border-0">
                        <span>🏚️ {r.guildName} <span className="text-[var(--color-text-muted)]">— ожидает рассмотрения</span></span>
                        <Button size="sm" variant="secondary" onClick={() => handleCancelRequest(r.id)}>Отменить</Button>
                    </div>
                ))}
            </Card>}
            <h3 className="font-bold text-sm mb-2">Гильдии</h3>
            {guildList.map((g:any)=>(<Card key={g.id} className="mb-2"><div className="flex justify-between items-center">
                <div><h4 className="font-bold text-sm">{g.name}</h4><p className="text-xs text-[var(--color-text-muted)]">Ур.{g.level} • {g.memberCount}/20 уч.</p></div>
                <Button size="md" onClick={()=>handleJoin(g.id,g.joinType)}>{g.joinType==='open'?'Вступить':'Заявка'}</Button></div></Card>))}
        </div>);
    }

    const myRank = guild.myRank;
    const canBuild = myRank==='leader'||myPerms.buildings;
    const canWar = myRank==='leader'||myPerms.war;
    const canTalents = myRank==='leader'||myPerms.buildings;

    return (<div className="max-w-3xl mx-auto px-4 py-4"><BackButton />
          {actionCard && <PageHeader title="Гильдия" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
        {message && <p className="text-sm text-green-400 mb-3">{message}</p>}{error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {/* Header */}
        <Card className="mb-4"><div className="flex justify-between items-start"><div className="flex gap-3">
            {guild.image ? <img src={guild.image} alt="Герб" className="w-14 h-14 object-cover rounded border-2 border-[var(--color-accent-gold)]"/> :
                <div className="w-14 h-14 rounded border-2 border-dashed border-[var(--color-border-light)] flex items-center justify-center text-[0.5rem] text-[var(--color-text-muted)]">герб</div>}
            <div><h2 className="font-bold text-lg">🏚️ {guild.name}</h2><p className="text-xs text-[var(--color-text-muted)]">Ур.{guild.level} • {members.length}/20 уч.{taxRate > 0 ? ` • Налог ${taxRate}%` : ''} • 💰 {treasuryBalance.toLocaleString()}</p>
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
        <div className="flex gap-1 mb-4 bg-[var(--color-bg-card)] rounded-lg p-1 flex-wrap">{TABS.map((l,i)=>(
            <button key={i} onClick={()=>setTab(i)} className={`py-1.5 px-2 text-xs font-medium rounded-md cursor-pointer transition-colors ${tab===i?'bg-[var(--color-accent-info)] text-white':'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>{l}</button>))}
        </div>

        {/* Tab 0: Обзор */}
        {tab===0 && <div className="space-y-4">
            <GuildQuestCard guildId={guild.id} myRank={myRank} myPerms={myPerms} api={api}/>
            {war ? (<Card className="border-l-4 border-l-red-500"><h3 className="font-bold text-sm flex items-center gap-2 mb-2"><Icon icon="game-icons:crossed-swords" width="18" height="18"/>⚔️ Война</h3>
                <p className="text-xs">Противник: <b>{war.attackerGuild?.id===guild.id?war.defenderGuild?.name:war.attackerGuild?.name}</b></p>
                <p className="text-xs text-[var(--color-text-muted)]">{war.status==='active'?<span>Активна · <span className="text-[var(--color-accent-warning)]">{warTimeLeft}</span></span>:war.status}</p>
                {war.status==='active'&&<>
                    <p className="text-[0.65rem] mt-1 text-red-400">💰 Казна заморожена</p>
                    <Button size="md" variant="danger" className="mt-2" onClick={()=>navigate('/guild/war')}>⚔️ На поле боя</Button>
                </>}</Card>
            ) : (<Card><div className="flex items-center gap-2 cursor-pointer" onClick={()=>setShowWarRules(!showWarRules)}>
                <Icon icon={showWarRules?'game-icons:expand':'game-icons:contract'} width="14" height="14"/><h3 className="font-bold text-sm">⚔️ Война гильдий — правила</h3>
            </div>{showWarRules&&<div className="text-xs text-[var(--color-text-muted)] mt-2 space-y-1">
                <p>• Лидер или офицер с правом объявляет войну</p><p>• Война начинается сразу и длится 72 часа</p><p>• Казна замораживается</p></div>}
            {canWar&&<div className="mt-2"><Button size="md" variant="danger" onClick={()=>navigate('/guild/rating')}>⚔️ Найти соперника</Button></div>}
            </Card>)}
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
                    {canBuild&&(
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
            {treasurySubtab==='deposit'&&<div className="flex gap-2"><input className={inputClass+' flex-1'} type={numType} placeholder="Сумма" value={treasuryAmount} onChange={e=>{const v=e.target.value.replace(/\D/g,'');setTreasuryAmount(v)}} data-vk-num/>
                <Button size="md" onClick={handleDeposit} disabled={loading}>Внести</Button></div>}
            {treasurySubtab==='tax'&&myRank==='leader'&&<div className="flex gap-2"><input className={inputClass+' flex-1'} type={numType} placeholder="0-50%" value={taxRateInput} onChange={e=>{const v=e.target.value.replace(/\D/g,'');setTaxRateInput(v)}} data-vk-num/>
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
            <Card><h3 className="font-bold text-sm mb-2">Участники ({members.length}/20)</h3><div className="space-y-1">
                {[...members].sort((a:any,b:any)=>{
                    const rankOrder = (r:string)=>r==='leader'?0:r==='officer'?1:2;
                    const ro = rankOrder(a.rank)-rankOrder(b.rank);
                    if (ro!==0) return ro;
                    return (b.level||0)-(a.level||0);
                }).map((m:any)=>(<div key={m.userId} className="py-1 border-b border-[var(--color-border-light)] text-xs">
                    <div className="flex justify-between items-center">
                        <span className="cursor-pointer hover:text-[var(--color-accent-info)]" onClick={()=>navigate(`/profile/${m.userId}`)}>
                            {m.rank==='leader'?'👑':m.rank==='officer'?'🛡️':'⚔️'}
                            {m.faction==='bandit' && <Icon icon="game-icons:hood" width="10" height="10" className="inline-block text-red-300 mr-0.5" />}
                            {m.faction==='crafter' && <Icon icon="game-icons:anvil" width="10" height="10" className="inline-block text-blue-300 mr-0.5" />}
                            {m.faction==='guard' && <Icon icon="game-icons:shield" width="10" height="10" className="inline-block text-yellow-300 mr-0.5" />}
                            {m.username} ур.{m.level}
                            {m.rank==='officer'&&<span className="ml-1 text-[0.6rem]">
                                {(m.can_quests||m.quests)?'📜':''}{(m.can_buildings||m.buildings)?'🏘️':''}{(m.can_war||m.war)?'⚔️':''}
                            </span>}</span>
                        {(() => {
                            if (m.online) {
                                return <span className="text-green-500 dark:text-green-400 whitespace-nowrap font-medium">В игре</span>;
                            }
                            return <span className="text-[var(--color-text-muted)] whitespace-nowrap">Был в игре: {getLastSeen(m.lastLoginAt).text}</span>;
                        })()}
                    </div>
                    {myRank==='leader'&&m.rank!=='leader'&&<div className="flex justify-between items-center mt-1">
                        <div className="flex gap-1">
                            {m.rank==='officer'&&<Button size="md" variant="secondary" onClick={()=>setPermPopup({officerId:m.userId,username:m.username,quests:!!(m.can_quests||m.quests),buildings:!!(m.can_buildings||m.buildings),war:!!(m.can_war||m.war)})}>⚙️</Button>}
                            <Button size="md" variant="secondary" onClick={()=>handleRole(m.userId,m.username,m.rank==='officer'?'member':'officer')}>{m.rank==='officer'?'Разжаловать':'Повысить'}</Button>
                        </div>
                        <Button size="md" variant="secondary" onClick={()=>handleKick(m.userId,m.username)}>Исключить</Button>
                    </div>}
                </div>))}</div></Card>
        </div>}

        {/* Tab 4: Босс */}
        {tab===4 && <div className="space-y-4">
            {/* Boss card */}
            {boss && <Card>
                <h3 className="font-bold text-sm mb-2">👾 Багровый исполин — уровень {boss.level}</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    Побеждён {boss.killCount} раз · Атака доступна раз в час · +1 очко личных талантов за каждую атаку · +1 очко гильдийских талантов за убийство
                </p>
                <div className="mb-1">
                    <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5">
                        <span>HP: {boss.currentHp?.toLocaleString()} / {boss.maxHp?.toLocaleString()}</span>
                        <span>{boss.currentHp > 0 ? Math.round(boss.currentHp / boss.maxHp * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-3 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 rounded-full transition-all" style={{width:`${boss.currentHp > 0 ? Math.max(0.5, (boss.currentHp/boss.maxHp)*100) : 0}%`}}/>
                    </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-3">
                    <span className="flex items-center gap-0.5"><Icon icon="game-icons:biceps" width="12" height="12"/>{boss.atk}</span>
                    <span className="flex items-center gap-0.5"><Icon icon="game-icons:sprint" width="12" height="12"/>{boss.agi}</span>
                    <span className="flex items-center gap-0.5"><Icon icon="game-icons:shield" width="12" height="12"/>{boss.def}</span>
                    <span className="flex items-center gap-0.5"><Icon icon="game-icons:crossed-swords" width="12" height="12"/>{boss.mst}</span>
                    {boss.effects && boss.effects.length > 0 && <span className="text-[var(--color-accent-warning)]">| {boss.effects.map((e: any) => e.name).join(', ')}</span>}
                </div>
                {bossSteps.length > 0 && (
                    <BossBattleLog steps={bossSteps} />
                )}
                {bossResult && (
                    <div className={`text-xs font-bold mb-2 ${bossResult.playerWon ? 'text-green-400' : 'text-red-400'}`}>
                        {bossResult.playerWon ? '🏆 Победа!' : '💀 Поражение!'} Урон: {bossResult.damageDealt?.toLocaleString()}
                        {bossResult.bossKilled && <span className="text-yellow-400"> · Босс повержен! Новый появится через 5 минут.</span>}
                    </div>
                )}
                {boss.currentHp <= 0 && boss.respawnAt > 0 && (
                    <div className="text-xs text-[var(--color-accent-warning)] mb-2">
                        Босс повержен. Новый появится через {fmtCd(Math.max(0, boss.respawnAt - Math.floor(Date.now()/1000)))}
                    </div>
                )}
                <Button size="md" variant="danger" disabled={bossCd > 0 || bossFighting} onClick={handleBossAttack}>
                    {bossFighting ? 'Бой...' : bossCd > 0 ? `Атака через ${fmtCd(bossCd)}` : '⚔️ Атаковать'}
                </Button>
            </Card>}

            {/* Battle History */}
            <Card>
                <h3 className="font-bold text-sm mb-2">📜 История атак</h3>
                {viewingLog && (
                    <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold">Бой: {viewingLog.username}</span>
                            <Button size="sm" variant="secondary" onClick={() => setViewingLog(null)}>Закрыть</Button>
                        </div>
                        <BossBattleLog steps={viewingLog.steps} />
                    </div>
                )}
                {battleHistory.length > 0 && (
                    <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                        {battleHistory.map((b: any) => (
                            <div key={b.id} className="flex justify-between items-center py-1 border-b border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-bg-hover)] rounded px-1"
                                onClick={() => setViewingLog({ username: b.username, steps: b.steps })}>
                                <span>{b.username} <span className={b.playerWon ? 'text-green-400' : 'text-red-400'}>{b.playerWon ? '🏆' : '💀'}</span></span>
                                <span className="text-[var(--color-text-muted)]">−{b.damageDealt?.toLocaleString()} HP {b.bossKilled ? '💥' : ''}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Ratings */}
            {ratings && (
            <Card>
                <h3 className="font-bold text-sm mb-2">🏆 Рейтинги</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Топ гильдии */}
                    <div>
                        <h4 className="font-medium mb-1 text-[var(--color-accent-gold)]">⭐ Гильдия (топ-5)</h4>
                        {ratings.guildTop?.map((r: any, i: number) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                                <span>{i+1}. <span className="cursor-pointer hover:text-[var(--color-accent-info)]" onClick={() => navigate(`/profile/${r.userId}`)}>{r.username}</span> <span className="text-[var(--color-text-muted)]">{r.level}ур.</span>{r.guildName && <span className="text-green-400 cursor-pointer hover:underline ml-1" onClick={(e) => { e.stopPropagation(); navigate(`/guild/${r.guildName}`); }}>[{r.guildName}]</span>}</span>
                                <span className="text-[var(--color-text-muted)]">{r.total?.toLocaleString()}</span>
                            </div>
                        ))}
                        {(!ratings.guildTop || ratings.guildTop.length === 0) && <span className="text-[var(--color-text-muted)]">Нет данных</span>}
                    </div>
                    {/* Место игрока */}
                    <div>
                        <h4 className="font-medium mb-1 text-[var(--color-accent-info)]">👤 Игроки (топ-5)</h4>
                        {ratings.personalTop?.map((r: any, i: number) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                                <span>{i+1}. <span className="cursor-pointer hover:text-[var(--color-accent-info)]" onClick={() => navigate(`/profile/${r.userId}`)}>{r.username}</span> <span className="text-[var(--color-text-muted)]">{r.level}ур.</span>{r.guildName && <span className="text-green-400 cursor-pointer hover:underline ml-1" onClick={(e) => { e.stopPropagation(); navigate(`/guild/${r.guildName}`); }}>[{r.guildName}]</span>}</span>
                                <span className="text-[var(--color-text-muted)]">{r.total?.toLocaleString()}</span>
                            </div>
                        ))}
                        {ratings.personalRank && (
                            <div className="text-[var(--color-text-muted)] mt-1">Ваше место: #{ratings.personalRank.rank} · {ratings.personalRank.total?.toLocaleString()} урона</div>
                        )}
                    </div>
                    {/* Место гильдии */}
                    <div>
                        <h4 className="font-medium mb-1 text-[var(--color-accent-info)]">🏚️ Гильдии (топ-5)</h4>
                        {ratings.guildTopList?.map((r: any, i: number) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                                <span>{i+1}. <span className="text-green-400 cursor-pointer hover:underline" onClick={() => navigate(`/guild/${r.name}`)}>{r.name}</span></span>
                                <span className="text-[var(--color-text-muted)]">{r.total?.toLocaleString()}</span>
                            </div>
                        ))}
                        {ratings.guildRank && (
                            <div className="text-[var(--color-text-muted)] mt-1">Ваша гильдия: #{ratings.guildRank.rank} · {ratings.guildRank.total?.toLocaleString()} урона</div>
                        )}
                    </div>
                    {/* Сильнейшие удары */}
                    <div>
                        <h4 className="font-medium mb-1 text-[var(--color-accent-warning)]">💥 Рекордные удары (топ-5)</h4>
                        {ratings.topHits?.map((r: any, i: number) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                                <span>{i+1}. <span className="cursor-pointer hover:text-[var(--color-accent-info)]" onClick={() => navigate(`/profile/${r.userId}`)}>{r.username}</span> <span className="text-[var(--color-text-muted)]">{r.level}ур.</span>{r.guildName && <span className="text-green-400 cursor-pointer hover:underline ml-1" onClick={(e) => { e.stopPropagation(); navigate(`/guild/${r.guildName}`); }}>[{r.guildName}]</span>}</span>
                                <span className="text-[var(--color-text-muted)]">{r.maxDmg?.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                    {/* Топ гильдий по убийствам */}
                    <div>
                        <h4 className="font-medium mb-1 text-red-400">💀 Убийств боссов (топ-5)</h4>
                        {ratings.topGuildKills?.map((r: any, i: number) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                                <span>{i+1}. <span className="text-green-400 cursor-pointer hover:underline" onClick={() => navigate(`/guild/${r.name}`)}>{r.name}</span></span>
                                <span className="text-[var(--color-text-muted)]">{r.kills}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
            )}

        </div>}

        {/* Tab 5: Таланты */}
        {tab===5 && <div className="space-y-4">
            <div className="sm:grid sm:grid-cols-2 sm:gap-4 space-y-4 sm:space-y-0">
            <Card>
                <h3 className="font-bold text-sm mb-2">🌟 Личные таланты</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    Очков: <span className="text-yellow-400 font-bold">{playerPoints}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {talentInfo.map((t: any) => (
                        <div key={t.type} className="border border-[var(--color-border-light)] rounded-lg p-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium">{t.label} ур.{t.playerLevel}</span>
                                <span className="text-[0.6rem] text-yellow-400">{t.playerLevel + t.guildLevel}%</span>
                            </div>
                            <p className="text-[0.55rem] text-[var(--color-text-muted)] mb-1">{t.desc}</p>
                            <div className="mb-1">
                                <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5">
                                    <span>{t.playerProgress}/{t.playerUpgradeCost}</span>
                                </div>
                                <div className="w-full h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all" style={{width:`${Math.min(100, (t.playerProgress / t.playerUpgradeCost) * 100)}%`}}/>
                                </div>
                            </div>
                            <Button size="sm" disabled={playerPoints < 1} onClick={() => handleTalentUpgrade(t.type, 'personal')}>
                                Вложить 1
                            </Button>
                        </div>
                    ))}
                </div>
            </Card>
            <Card>
                <h3 className="font-bold text-sm mb-2">🏛️ Гильдийские таланты</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    Очков гильдии: <span className="text-yellow-400 font-bold">{guildPoints}</span>
                    {myRank !== 'leader' && <span className="text-[var(--color-text-muted)]"> · Вкладывает лидер</span>}
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {talentInfo.map((t: any) => (
                        <div key={t.type} className="border border-[var(--color-border-light)] rounded-lg p-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium">{t.label} ур.{t.guildLevel}</span>
                                <span className="text-[0.6rem] text-yellow-400">{t.playerLevel + t.guildLevel}%</span>
                            </div>
                            <p className="text-[0.55rem] text-[var(--color-text-muted)] mb-1">{t.desc}</p>
                            <div className="mb-1">
                                <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5">
                                    <span>{t.guildProgress}/{t.guildUpgradeCost}</span>
                                </div>
                                <div className="w-full h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--color-accent-gold)] rounded-full transition-all" style={{width:`${Math.min(100, (t.guildProgress / t.guildUpgradeCost) * 100)}%`}}/>
                                </div>
                            </div>
                            {myRank === 'leader' && (
                                <Button size="sm" variant="secondary" disabled={guildPoints < 1} onClick={() => handleTalentUpgrade(t.type, 'guild')}>
                                    Вложить 1
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
            </div>
        </div>}

        {/* Permissions popup */}
        {permPopup&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setPermPopup(null)}>
            <Card className="max-w-xs w-full" onClick={e=>e.stopPropagation()}>
                <p className="text-sm font-bold mb-3">Разрешения: {permPopup.username}</p>
                {[{k:'quests',l:'📜 Квесты'},{k:'buildings',l:'🏘️ Постройки'},{k:'war',l:'⚔️ Война'}].map(p=>(
                    <label key={p.k} className="flex items-center gap-2 mb-2 cursor-pointer text-sm"
                        onClick={()=>setPermPopup((prev:any)=>({...prev,[p.k]:!prev[p.k]}))}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${permPopup[p.k]?'bg-[var(--color-accent-info)] border-[var(--color-accent-info)] text-white':'border-[var(--color-border-light)]'}`}>{permPopup[p.k]?'✓':''}</span>
                        {p.l}</label>
                ))}
                <div className="flex gap-2 justify-end mt-3">
                    <Button variant="secondary" size="md" onClick={()=>setPermPopup(null)}>Отмена</Button>
                    <Button size="md" onClick={async()=>{
                        const p = permPopup;
                        setPermPopup(null);
                        try {
                            await Promise.all(['quests','buildings','war'].map(k=>api('/guild/officer-permissions',{officerId:p.officerId,permission:k,value:p[k]}).catch(()=>{})));
                            load();
                        } catch {}
                    }}>Сохранить</Button></div></Card></div>}

        {/* Popup */}
        {confirmPopup&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setConfirmPopup(null)}>
            <Card className="max-w-xs w-full" onClick={e=>e.stopPropagation()}><p className="text-sm mb-3">{confirmPopup.message}</p>
                <div className="flex gap-2 justify-end"><Button variant="secondary" size="md" onClick={()=>setConfirmPopup(null)}>Отмена</Button><Button size="md" onClick={confirmPopup.onConfirm}>OK</Button></div></Card></div>}
    </div>);
}

function ExpBar({exp,level}:{exp:number;level:number}){const n=100*Math.pow(2,level-1);return <div className="mt-1"><div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5"><span>Опыт</span><span>{exp}/{n}</span></div><div className="w-full h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden"><div className="h-full bg-[var(--color-accent-gold)] rounded-full transition-all" style={{width:`${Math.min(100,(exp/n)*100)}%`}}/></div></div>}

function GuildQuestCard({guildId:_guildId,myRank,myPerms,api}:{guildId:number;myRank:string;myPerms:{quests:boolean;buildings:boolean;war:boolean};api:any}){
    const [aq,setAq]=useState<any>(null);const [opts,setOpts]=useState<any[]|null>(null);const [m,setM]=useState('');const [l,setL]=useState(false);
    useEffect(()=>{load();const h=(e:any)=>{if(e.detail?.id)setAq(e.detail)};window.addEventListener('guildQuestProgress',h);return()=>window.removeEventListener('guildQuestProgress',h)},[]);
    const load=async()=>{const r=await fetch('/api/guild/quest',{headers:getHeaders()});const d=await r.json();setAq(d.activeQuest||null);setOpts(d.options||null)};
    const take=async(o:any)=>{setL(true);try{await api('/guild/quest/take',{questType:o.questType,difficulty:o.difficulty,requirement:o.requirement,rewardXp:o.rewardXp});load()}catch(e:any){setM(e.message)}setL(false)};
    const claim=async()=>{setL(true);try{const d=await api('/guild/quest/claim',{});setM(d.message||`+${d.rewardXp} XP!`);load()}catch(e:any){setM(e.message)}setL(false)};
    const canQuests = myRank==='leader'||myPerms.quests;
    return <Card><h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Icon icon="game-icons:scroll-unfurled" width="16" height="16"/>Задание гильдии</h3>{m&&<p className="text-xs text-green-400 mb-2">{m}</p>}
        {aq?<><p className="text-xs font-medium">{aq.typeName} <span className="text-[0.6rem] text-[var(--color-text-muted)]">{aq.difficultyLabel}</span></p><p className="text-xs text-[var(--color-text-muted)] mb-2">{aq.description}</p>
            <div className="mb-1"><div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mb-0.5"><span>{aq.progress}/{aq.requirement}</span><span>+{aq.rewardXp} XP</span></div>
            <div className="w-full h-1.5 bg-[var(--color-bg-input)] rounded-full"><div className="h-full bg-[var(--color-accent-info)] rounded-full" style={{width:`${Math.min(100,(aq.progress/aq.requirement)*100)}%`}}/></div></div>
            {canQuests&&aq.progress>=aq.requirement&&<Button variant="primary" size="md" onClick={claim} disabled={l} className="mt-2">Забрать</Button>}</>
        :opts?<><p className="text-xs text-[var(--color-text-muted)] mb-2">Выберите задание:</p><div className="space-y-2">{opts.map((o:any,i:number)=>(<div key={i} className="border border-[var(--color-border-light)] rounded-lg p-2">
            <div className="flex justify-between mb-1"><span className="text-xs font-medium">{o.typeName}</span><span className="text-[0.6rem] text-[var(--color-text-muted)]">{o.difficultyLabel}</span></div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{o.description}</p><div className="flex justify-between"><span className="text-[0.6rem] text-yellow-400">+{o.rewardXp} XP</span>
            {canQuests&&<Button variant="primary" size="md" onClick={()=>take(o)} disabled={l}>Взять</Button>}</div></div>))}</div>
            {!canQuests&&<p className="text-[0.6rem] text-[var(--color-text-muted)] mt-2">Ожидайте выбора лидера</p>}</>:null}</Card>;
}

function BossBattleLog({ steps }: { steps: any[] }) {
    const effectStyle = (s: any): string => {
        switch (s.type) {
            case 'crit': return 'text-yellow-300 font-bold';
            case 'dodge': return 'text-blue-400 italic';
            case 'block': return 'text-gray-300';
            case 'fullBlock': return 'text-amber-400 font-bold';
            case 'counter': return 'text-orange-400';
            case 'stun': return 'text-purple-400';
            case 'end': return 'text-green-400 font-bold';
            default: return '';
        }
    };
    const effectIcon = (s: any): string => {
        switch (s.type) {
            case 'crit': return '💥';
            case 'dodge': return '🌀';
            case 'block': return '🛡';
            case 'fullBlock': return '🛡️';
            case 'counter': return '↩️';
            case 'stun': return '💫';
            default: return '';
        }
    };

    // Чередуем фон по ходам: attack от игрока → фон игрока, attack от босса → фон босса
    let isPlayerTurn = true; // первый ход всегда игрока
    return (
        <div className="mb-3 max-h-64 overflow-y-auto text-[0.65rem] border border-[var(--color-border-light)] rounded">
            {steps.map((s: any, i: number) => {
                // Переключаем сторону при начале нового хода (type === 'attack')
                if (s.type === 'attack') {
                    isPlayerTurn = s.actor === 'attacker';
                }
                const icon = effectIcon(s);
                const bg = isPlayerTurn ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-input)]';
                return (
                    <div key={i} className={`flex items-start gap-1 py-0.5 px-2 ${bg} ${effectStyle(s)} border-b border-[var(--color-border-light)] last:border-0`}>
                        {icon && <span className="flex-shrink-0 w-4 text-center">{icon}</span>}
                        {!icon && <span className="flex-shrink-0 w-4" />}
                        <span>{s.message}</span>
                    </div>
                );
            })}
        </div>
    );
}
