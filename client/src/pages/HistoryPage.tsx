import { Icon } from "@iconify/react";
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchBattles } from '../api';
import { fetchJobHistory } from '../api';
import { fetchAllPrivateMessagesNew } from '../api/chat';
import { getHeaders, BASE_URL } from '../api/helpers';
import { formatMoney } from '../utils/money';
import { renderBattleLog } from '../utils/battleLog';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';

const LIMIT = 10;

export default function HistoryPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'all' | 'battles' | 'pve' | 'jobs' | 'tournaments' | 'quests' | 'messages'>('all');
    const [battles, setBattles] = useState<any[]>([]);
    const [pveBattles, setPveBattles] = useState<any[]>([]);
    const [jobHistory, setJobHistory] = useState<any[]>([]);
    const [privateMessages, setPrivateMessages] = useState<any[]>([]);
    const [tournamentHistory, setTournamentHistory] = useState<any[]>([]);
    const [questHistory, setQuestHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedBattle, setSelectedBattle] = useState<any>(null);

    const loadData = useCallback(async () => {
        if (!user) return; setLoading(true);
        try {
            const [b, jh, pm, pve, th, qh] = await Promise.all([
                fetchBattles(100).catch(()=>[]), fetchJobHistory().catch(()=>[]),
                fetchAllPrivateMessagesNew().then(msgs=>(msgs as any[]).filter(m=>m.targetId===user.id)).catch(()=>[]),
                fetch(`${BASE_URL}/log/pve-battles?limit=100`,{headers:getHeaders()}).then(r=>r.json()).catch(()=>[]),
                fetch(`${BASE_URL}/log/tournament-history?limit=50`,{headers:getHeaders()}).then(r=>r.json()).catch(()=>[]),
                fetch(`${BASE_URL}/log/quest-history?limit=50`,{headers:getHeaders()}).then(r=>r.json()).catch(()=>[]),
            ]);
            setBattles(Array.isArray(b)?b:[]); setJobHistory(Array.isArray(jh)?jh:[]);
            setPrivateMessages(Array.isArray(pm)?pm:[]); setPveBattles(Array.isArray(pve)?pve:[]);
            setTournamentHistory(Array.isArray(th)?th:[]); setQuestHistory(Array.isArray(qh)?qh:[]);
        } catch(e){console.error(e)} finally {setLoading(false)}
    }, [user]);

    useEffect(()=>{if(!user){navigate('/login');return}loadData()},[user,loadData,navigate]);

    const allEntries = [
        ...battles.map(b=>({id:`b-${b.id}`,type:'battle',ts:new Date(b.createdAt).getTime(),data:b})),
        ...pveBattles.map(b=>({id:`p-${b.id}`,type:'pve',ts:new Date(b.createdAt).getTime(),data:b})),
        ...jobHistory.map(j=>({id:`j-${j.id}`,type:'job',ts:new Date(j.finishedAt).getTime(),data:j})),
        ...tournamentHistory.map(t=>({id:`t-${t.id}`,type:'tournament',ts:new Date(t.createdAt).getTime(),data:t})),
        ...questHistory.map(q=>({id:`q-${q.id}`,type:'quest',ts:new Date(q.createdAt).getTime(),data:q})),
        ...privateMessages.map(m=>({id:`m-${m.id}`,type:'message',ts:new Date(m.createdAt).getTime(),data:m})),
    ].sort((a,b)=>b.ts-a.ts);

    const currentData = (()=>{switch(tab){
        case 'all':return allEntries;case 'battles':return battles;case 'pve':return pveBattles;
        case 'jobs':return jobHistory;case 'tournaments':return tournamentHistory;case 'quests':return questHistory;
        case 'messages':return privateMessages;default:return[];
    }})();

    const totalItems = currentData.length;
    const totalPagesCalc = Math.ceil(totalItems/LIMIT);
    useEffect(()=>{setPage(1)},[tab]);
    useEffect(()=>{setTotalPages(totalPagesCalc||1)},[totalPagesCalc]);
    const startIdx=(page-1)*LIMIT;
    const paginatedData=currentData.slice(startIdx,startIdx+LIMIT);

    const tabs = [
        {key:'all',label:'Все'},{key:'battles',label:'PvP'},{key:'pve',label:'Охота'},
        {key:'jobs',label:'Работы'},{key:'tournaments',label:'Турниры'},{key:'quests',label:'Квесты'},
        {key:'messages',label:'Сообщения'},
    ] as const;

    if(!user) return null;

    // Универсальная строка записи: контент слева, время справа
    const EntryRow = ({ children, time, className='', onClick }: { children: React.ReactNode; time: string; className?: string; onClick?: ()=>void }) => (
        <div className={`border-b border-[var(--color-border-light)] py-2 text-xs flex items-center gap-2 ${onClick?'cursor-pointer hover:bg-[var(--color-bg-card-hover)] px-1 rounded':''} ${className}`} onClick={onClick}>
            <div className="flex-1 min-w-0">{children}</div>
            <span className="text-[var(--color-text-muted)] shrink-0 ml-auto text-[0.65rem]">{time}</span>
        </div>
    );

    const fmt = (d: any) => new Date(d).toLocaleString();
    const fmtTs = (ts: number) => new Date(ts*1000).toLocaleDateString();

    const renderBattleRow = (b: any) => {
        const win = b.winnerId === user.id;
        return <EntryRow time={fmt(b.createdAt)} onClick={()=>setSelectedBattle(b)}>
            <span><Icon icon="game-icons:crossed-swords" width="14" height="14" className="inline mr-1"/>{b.attackerId===user.id?'Вы атаковали':'На вас напал'} <strong>{b.attackerId===user.id?b.defenderName:b.attackerName}</strong></span>
            <span className={`font-bold ml-2 ${win?'text-[var(--color-accent-success)]':'text-red-500'}`}>{win?'Победа':'Поражение'}</span>
            {b.expGained>0&&<span className="text-[var(--color-accent-purple)] ml-1">+{b.expGained} XP</span>}
            {b.expLost>0&&<span className="text-red-400 ml-1">-{b.expLost} XP</span>}
            {b.moneyStolen>0&&<span className="text-[var(--color-text-accent)] ml-1">{win?'+':'-'}{formatMoney(b.moneyStolen)}</span>}
        </EntryRow>;
    };
    const renderPveRow = (b: any) => <EntryRow time={fmt(b.createdAt)} onClick={()=>setSelectedBattle(b)}>
        <span><Icon icon="game-icons:death-skull" width="14" height="14" className="inline mr-1"/><strong>{b.mobName}</strong> <span className="text-[var(--color-text-muted)]">ур.{b.mobLevel}</span></span>
        <span className={`font-bold ml-2 ${b.playerWon?'text-[var(--color-accent-success)]':'text-red-500'}`}>{b.playerWon?'Победа':'Поражение'}</span>
        {b.expGained>0&&<span className="text-[var(--color-accent-purple)] ml-1">+{b.expGained} XP</span>}
        {b.goldGained>0&&<span className="text-[var(--color-text-accent)] ml-1">+{formatMoney(b.goldGained)}</span>}
        {b.goldLost>0&&<span className="text-red-500 ml-1">-{formatMoney(b.goldLost)}</span>}
    </EntryRow>;
    const renderJobRow = (j: any) => <EntryRow time={fmt(j.finishedAt)}>
        <span><Icon icon="game-icons:swap-bag" width="14" height="14" className="inline mr-1"/>«{j.jobName}» — {formatMoney(j.reward)}{j.premiumBonus>0&&<span style={{color:'#f1c40f'}}> (+{j.premiumBonus} пр.)</span>}</span>
    </EntryRow>;
    const renderTournamentRow = (t: any) => {
        const ss = t.snapshotStats?JSON.parse(t.snapshotStats):null;
        const canc = t.status==='cancelled';
        return <EntryRow time={fmtTs(t.createdAt)}>
            <span><Icon icon="game-icons:trophy" width="14" height="14" className="inline mr-1"/>Турнир «{t.division==='custom'?t.name||'Турнир':t.division}»{canc?' отменён':' завершён'}</span>
            {canc?<span className="text-[var(--color-text-muted)] ml-1">Не набралось игроков</span>:
            ss?<span className="text-[var(--color-accent-success)] font-bold ml-1">{ss.place}-е место {ss.prize>0?formatMoney(ss.prize):'без приза'}</span>:
            <span className="text-[var(--color-text-muted)] ml-1">Участие</span>}
        </EntryRow>;
    };
    const renderQuestRow = (q: any) => <EntryRow time={q.createdAt.replace('T', ' ').slice(0, 19)} onClick={()=>navigate('/tavern?tab=quests')}>
        <span className="text-[var(--color-accent-success)]"><Icon icon="game-icons:notebook" width="14" height="14" className="inline mr-1"/>Квест «{q.typeName}»</span>
        {q.rewardXp>0&&<span className="text-[var(--color-accent-purple)] ml-1">+{q.rewardXp} XP</span>}
        <span className="text-[var(--color-text-accent)] ml-1">{formatMoney(q.rewardMoney)}</span>
    </EntryRow>;
    const renderMessageRow = (m: any) => <EntryRow time={fmt(m.createdAt)}>
        <span className="text-purple-400"><Icon icon="game-icons:chat-bubble" width="14" height="14" className="inline mr-1"/>{m.senderName}: {m.content}</span>
    </EntryRow>;

    const renderEntry = (entry: any) => {
        const { data, type } = entry;
        if (type === 'battle') {
            const win = data.winnerId === user.id;
            return <EntryRow time={fmt(data.createdAt)} onClick={()=>setSelectedBattle(data)}>
                <span><Icon icon="game-icons:crossed-swords" width="14" height="14" className="inline mr-1"/>{data.attackerId===user.id?'Вы атаковали':'На вас напал'} <strong>{data.attackerId===user.id?data.defenderName:data.attackerName}</strong></span>
                <span className={`font-bold ml-2 ${win?'text-[var(--color-accent-success)]':'text-red-500'}`}>{win?'Победа':'Поражение'}</span>
                {data.expGained>0&&<span className="text-[var(--color-accent-purple)] ml-1">+{data.expGained} XP</span>}
                {data.expLost>0&&<span className="text-red-400 ml-1">-{data.expLost} XP</span>}
                {data.moneyStolen>0&&<span className="text-[var(--color-text-accent)] ml-1">{win?'+':'-'}{formatMoney(data.moneyStolen)}</span>}
            </EntryRow>;
        }
        if (type === 'pve') {
            return <EntryRow time={fmt(data.createdAt)} onClick={()=>setSelectedBattle(data)}>
                <span><Icon icon="game-icons:death-skull" width="14" height="14" className="inline mr-1"/><strong>{data.mobName}</strong> <span className="text-[var(--color-text-muted)]">ур.{data.mobLevel}</span></span>
                <span className={`font-bold ml-2 ${data.playerWon?'text-[var(--color-accent-success)]':'text-red-500'}`}>{data.playerWon?'Победа':'Поражение'}</span>
                {data.expGained>0&&<span className="text-[var(--color-accent-purple)] ml-1">+{data.expGained} XP</span>}
                {data.goldGained>0&&<span className="text-[var(--color-text-accent)] ml-1">+{formatMoney(data.goldGained)}</span>}
                {data.goldLost>0&&<span className="text-red-500 ml-1">-{formatMoney(data.goldLost)}</span>}
            </EntryRow>;
        }
        if (type === 'job') {
            return <EntryRow time={fmt(data.finishedAt)}>
                <span><Icon icon="game-icons:swap-bag" width="14" height="14" className="inline mr-1"/>«{data.jobName}» — {formatMoney(data.reward)}{data.premiumBonus>0&&<span style={{color:'#f1c40f'}}> (+{data.premiumBonus} пр.)</span>}</span>
            </EntryRow>;
        }
        if (type === 'tournament') {
            const ss = data.snapshotStats?JSON.parse(data.snapshotStats):null;
            const canc = data.status==='cancelled';
            return <EntryRow time={fmtTs(data.createdAt)}>
                <span><Icon icon="game-icons:trophy" width="14" height="14" className="inline mr-1"/>Турнир «{data.division==='custom'?data.name||'Турнир':data.division}»{canc?' отменён':' завершён'}</span>
                {canc?<span className="text-[var(--color-text-muted)] ml-1">Не набралось игроков</span>:
                ss?<span className="text-[var(--color-accent-success)] font-bold ml-1">{ss.place}-е место {ss.prize>0?formatMoney(ss.prize):'без приза'}</span>:
                <span className="text-[var(--color-text-muted)] ml-1">Участие</span>}
            </EntryRow>;
        }
        if (type === 'quest') {
            return <EntryRow time={data.createdAt.replace('T', ' ').slice(0, 19)} onClick={()=>navigate('/tavern?tab=quests')}>
                <span className="text-[var(--color-accent-success)]"><Icon icon="game-icons:notebook" width="14" height="14" className="inline mr-1"/>Квест «{data.typeName}»</span>
                {data.rewardXp>0&&<span className="text-[var(--color-accent-purple)] ml-1">+{data.rewardXp} XP</span>}
                <span className="text-[var(--color-text-accent)] ml-1">{formatMoney(data.rewardMoney)}</span>
            </EntryRow>;
        }
        if (type === 'message') {
            return <EntryRow time={fmt(data.createdAt)}>
                <span className="text-purple-400"><Icon icon="game-icons:chat-bubble" width="14" height="14" className="inline mr-1"/>{data.senderName}: {data.content}</span>
            </EntryRow>;
        }
        return null;
    };

    return (
        <div className="px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:ringing-bell" width="22" height="22" className="inline mr-2"/>Уведомления</h2>
            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
                {tabs.map(t=><Button key={t.key} variant={tab===t.key?'danger':'secondary'} size="sm" onClick={()=>setTab(t.key)} className="whitespace-nowrap">{t.label}</Button>)}
            </div>
            {loading?<p className="text-[var(--color-text-muted)]">Загрузка...</p>:
            <Card>
                {paginatedData.length===0?<p className="text-[var(--color-text-muted)]">Нет записей</p>:
                tab==='all'?paginatedData.map(entry=><div key={entry.id}>{renderEntry(entry)}</div>):
                tab==='battles'?paginatedData.map((b:any)=><div key={b.id}>{renderBattleRow(b)}</div>):
                tab==='pve'?paginatedData.map((b:any)=><div key={b.id}>{renderPveRow(b)}</div>):
                tab==='jobs'?paginatedData.map((j:any)=><div key={j.id}>{renderJobRow(j)}</div>):
                tab==='tournaments'?paginatedData.map((t:any)=><div key={t.id}>{renderTournamentRow(t)}</div>):
                tab==='quests'?paginatedData.map((q:any)=><div key={q.id}>{renderQuestRow(q)}</div>):
                paginatedData.map((m:any)=><div key={m.id}>{renderMessageRow(m)}</div>)}
                {totalPages>1&&<div className="flex justify-center gap-4 mt-4 items-center">
                    <Button size="sm" disabled={page<=1} onClick={()=>setPage(page-1)}>← Назад</Button>
                    <span className="text-sm text-[var(--color-text-secondary)]">стр. {page} из {totalPages}</span>
                    <Button size="sm" disabled={page>=totalPages} onClick={()=>setPage(page+1)}>Вперёд →</Button>
                </div>}
            </Card>}
            {selectedBattle&&<Modal open={!!selectedBattle} onClose={()=>setSelectedBattle(null)}
                title={`⚔ ${selectedBattle.attackerName||'Вы'} vs ${selectedBattle.defenderName||selectedBattle.mobName||'?'}`}
                width="min(900px, calc(100vw - 2rem))" borderColor="var(--color-border-default)">
                <div className="bg-black rounded-lg p-3 max-h-[60vh] overflow-y-auto font-mono text-xs leading-relaxed">
                    {renderBattleLog(typeof selectedBattle.steps==='string'?JSON.parse(selectedBattle.steps):(selectedBattle.steps||[]))}
                </div>
                <div className="flex justify-center mt-4"><Button variant="secondary" size="sm" onClick={()=>setSelectedBattle(null)}>Закрыть</Button></div>
            </Modal>}
        </div>
    );
}
