import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ImageUploader from '../../components/ImageUploader';
import { getHeaders } from '../../api/helpers';
import { inputClass, selectClass } from '../../utils/formStyles';

const SECTIONS = [
    { value: 'world', label: '🌍 МИР' },
    { value: 'castle', label: '🏰 Площадь' },
];

const ICONS = [
    'game-icons:death-skull', 'game-icons:swap-bag', 'game-icons:crossed-swords',
    'game-icons:buy-card', 'game-icons:bank', 'game-icons:anvil', 'game-icons:pay-money',
    'game-icons:drink-me', 'game-icons:castle', 'game-icons:notebook',
];

export default function AdminGame() {
    const [tab, setTab] = useState<'actions' | 'mobs' | 'floors'>('actions');
    const [message, setMessage] = useState('');

    // Actions
    const [actions, setActions] = useState<any[]>([]);
    const [editingAction, setEditingAction] = useState<any>(null);
    const [newAction, setNewAction] = useState({ section: 'world', title: '', subtitle: '', icon: 'game-icons:castle', bg_image: '', path: '', cost: 0, sort_order: 0 });

    // Mobs
    const [mobs, setMobs] = useState<any[]>([]);
    const [editingMob, setEditingMob] = useState<any>(null);
    const [locations, setLocations] = useState<string[]>([]);

    // Floors
    const [floors, setFloors] = useState<any[]>([]);
    const [editingFloor, setEditingFloor] = useState<any>(null);
    const [newFloor, setNewFloor] = useState({ name: '', background: '', sort_order: 0 });

    const api = async (method: string, url: string, body?: any) => {
        const r = await fetch(url, { method, headers: { ...getHeaders(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
    };

    const loadAll = async () => {
        const [ar, mr, lr, fr] = await Promise.all([
            fetch('/api/admin/actions', { headers: getHeaders() }),
            fetch('/api/admin/mobs', { headers: getHeaders() }),
            fetch('/api/admin/mob-locations', { headers: getHeaders() }),
            fetch('/api/admin/floors', { headers: getHeaders() }),
        ]);
        setActions(await ar.json());
        setMobs(await mr.json());
        setLocations(await lr.json());
        setFloors(await fr.json());
    };

    useEffect(() => { loadAll(); }, []);

    const renderActionsTab = () => (
        <>
            <Card className="mb-4">
                <h3 className="font-bold mb-2">{editingAction ? 'Редактировать действие' : 'Добавить действие'}</h3>
                <div className="grid grid-cols-2 gap-2">
                    <select value={(editingAction || newAction).section} onChange={e => editingAction ? setEditingAction({...editingAction, section: e.target.value}) : setNewAction({...newAction, section: e.target.value})} className={selectClass}>
                        {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <input placeholder="Название" value={(editingAction || newAction).title} onChange={e => editingAction ? setEditingAction({...editingAction, title: e.target.value}) : setNewAction({...newAction, title: e.target.value})} className={inputClass} />
                    <input placeholder="Подзаголовок" value={(editingAction || newAction).subtitle} onChange={e => editingAction ? setEditingAction({...editingAction, subtitle: e.target.value}) : setNewAction({...newAction, subtitle: e.target.value})} className={inputClass} />
                    <select value={(editingAction || newAction).icon} onChange={e => editingAction ? setEditingAction({...editingAction, icon: e.target.value}) : setNewAction({...newAction, icon: e.target.value})} className={selectClass}>
                        {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <input placeholder="Путь (напр. /shop)" value={(editingAction || newAction).path || ''} onChange={e => editingAction ? setEditingAction({...editingAction, path: e.target.value}) : setNewAction({...newAction, path: e.target.value})} className={inputClass} />
                    <input placeholder="Стоимость" type="number" value={(editingAction || newAction).cost} onChange={e => editingAction ? setEditingAction({...editingAction, cost: +e.target.value}) : setNewAction({...newAction, cost: +e.target.value})} className={inputClass} />
                    <input placeholder="Порядок" type="number" value={(editingAction || newAction).sort_order} onChange={e => editingAction ? setEditingAction({...editingAction, sort_order: +e.target.value}) : setNewAction({...newAction, sort_order: +e.target.value})} className={inputClass} />
                </div>
                <ImageUploader currentUrl={(editingAction || newAction).bg_image || null} folder="actions" onUploaded={(url) => editingAction ? setEditingAction({...editingAction, bg_image: url}) : setNewAction({...newAction, bg_image: url})} label="Фоновое изображение" className="mt-2" />
                <div className="mt-3 flex gap-2">
                    {editingAction ? (
                        <><Button variant="success" size="sm" onClick={async () => { try { await api('PUT', `/api/admin/actions/${editingAction.id}`, editingAction); setMessage('Сохранено'); setEditingAction(null); loadAll(); } catch(e:any) { setMessage(e.message); } }}>Сохранить</Button>
                         <Button variant="danger" size="sm" onClick={() => setEditingAction(null)}>Отмена</Button></>
                    ) : (
                        <Button variant="success" size="sm" onClick={async () => { try { await api('POST', '/api/admin/actions', newAction); setMessage('Создано'); loadAll(); setNewAction({ section: 'world', title: '', subtitle: '', icon: 'game-icons:castle', bg_image: '', path: '', cost: 0, sort_order: 0 }); } catch(e:any) { setMessage(e.message); } }}>Создать</Button>
                    )}
                </div>
            </Card>
            <Card><h3 className="font-bold mb-2">Все действия</h3>
                <table className="w-full text-sm"><thead><tr className="border-b border-[var(--color-border-default)]"><th className="text-left p-1">Раздел</th><th className="text-left p-1">Название</th><th className="text-left p-1">Путь</th><th className="p-1">Действия</th></tr></thead>
                    <tbody>{actions.map((a: any) => (<tr key={a.id} className="border-b border-[var(--color-border-light)]"><td className="p-1">{a.section}</td><td className="p-1">{a.title}</td><td className="p-1 text-xs">{a.path||'—'}</td><td className="p-1"><Button variant="primary" size="xs" className="mr-1" onClick={()=>setEditingAction(a)}>Ред.</Button><Button variant="danger" size="xs" onClick={async()=>{if(confirm('Удалить?')){await api('DELETE',`/api/admin/actions/${a.id}`);loadAll();}}}>Удалить</Button></td></tr>))}</tbody></table>
            </Card>
        </>
    );

    const renderMobsTab = () => (
        <>
            {editingMob && (
                <Card className="mb-4"><h3 className="font-bold mb-2">Редактировать моба: {editingMob.name}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input placeholder="Название" value={editingMob.name} onChange={e=>setEditingMob({...editingMob,name:e.target.value})} className={inputClass}/>
                        <input placeholder="Уровень" type="number" value={editingMob.level} onChange={e=>setEditingMob({...editingMob,level:+e.target.value})} className={inputClass}/>
                        <input placeholder="HP" type="number" value={editingMob.hp} onChange={e=>setEditingMob({...editingMob,hp:+e.target.value})} className={inputClass}/>
                        <input placeholder="Атака" type="number" value={editingMob.atk} onChange={e=>setEditingMob({...editingMob,atk:+e.target.value})} className={inputClass}/>
                        <input placeholder="Ловкость" type="number" value={editingMob.agi} onChange={e=>setEditingMob({...editingMob,agi:+e.target.value})} className={inputClass}/>
                        <input placeholder="Защита" type="number" value={editingMob.def} onChange={e=>setEditingMob({...editingMob,def:+e.target.value})} className={inputClass}/>
                        <input placeholder="Мастерство" type="number" value={editingMob.mst} onChange={e=>setEditingMob({...editingMob,mst:+e.target.value})} className={inputClass}/>
                        <input placeholder="XP" type="number" value={editingMob.xp} onChange={e=>setEditingMob({...editingMob,xp:+e.target.value})} className={inputClass}/>
                        <input placeholder="Золото мин" type="number" value={editingMob.gold_min} onChange={e=>setEditingMob({...editingMob,gold_min:+e.target.value})} className={inputClass}/>
                        <input placeholder="Золото макс" type="number" value={editingMob.gold_max} onChange={e=>setEditingMob({...editingMob,gold_max:+e.target.value})} className={inputClass}/>
                    </div>
                    <input placeholder="Описание" value={editingMob.description||''} onChange={e=>setEditingMob({...editingMob,description:e.target.value})} className={inputClass+' mt-2'}/>
                    <input placeholder="Локация" value={editingMob.location||''} onChange={e=>setEditingMob({...editingMob,location:e.target.value})} list="loc-list" className={inputClass+' mt-2'}/>
                    <datalist id="loc-list">{locations.map(l=><option key={l} value={l}/>)}</datalist>
                    <ImageUploader currentUrl={editingMob.background||null} folder="mobs" onUploaded={(url)=>setEditingMob({...editingMob,background:url})} label="Фон карточки моба" className="mt-2"/>
                    <div className="mt-3 flex gap-2"><Button variant="success" size="sm" onClick={async()=>{try{await api('PUT',`/api/admin/mobs/${editingMob.id}`,editingMob);setMessage('Сохранено');setEditingMob(null);loadAll();}catch(e:any){setMessage(e.message);}}}>Сохранить</Button><Button variant="danger" size="sm" onClick={()=>setEditingMob(null)}>Отмена</Button></div>
                </Card>
            )}
            <Card><h3 className="font-bold mb-2">Мобы ({mobs.length})</h3>
                <table className="w-full text-sm"><thead><tr className="border-b border-[var(--color-border-default)]"><th className="text-left p-1">Название</th><th className="p-1">Ур.</th><th className="p-1">HP</th><th className="text-left p-1">Локация</th><th className="p-1"></th></tr></thead>
                    <tbody>{mobs.map((m:any)=>(<tr key={m.id} className="border-b border-[var(--color-border-light)]"><td className="p-1">{m.name}</td><td className="p-1 text-center">{m.level}</td><td className="p-1 text-center">{m.hp}</td><td className="p-1 text-xs">{m.location}</td><td className="p-1"><Button variant="primary" size="xs" onClick={()=>setEditingMob(m)}>Ред.</Button></td></tr>))}</tbody></table>
            </Card>
        </>
    );

    const renderFloorsTab = () => (
        <>
            <Card className="mb-4">
                <h3 className="font-bold mb-2">{editingFloor ? 'Редактировать этаж' : 'Добавить этаж'}</h3>
                <div className="flex gap-2 items-end">
                    <input placeholder="Название этажа" value={(editingFloor || newFloor).name} onChange={e => editingFloor ? setEditingFloor({...editingFloor, name: e.target.value}) : setNewFloor({...newFloor, name: e.target.value})} className={inputClass} />
                    <input placeholder="Порядок" type="number" value={(editingFloor || newFloor).sort_order} onChange={e => editingFloor ? setEditingFloor({...editingFloor, sort_order: +e.target.value}) : setNewFloor({...newFloor, sort_order: +e.target.value})} className={inputClass} style={{width:'80px'}} />
                </div>
                <ImageUploader currentUrl={(editingFloor || newFloor).background || null} folder="floors" onUploaded={(url) => editingFloor ? setEditingFloor({...editingFloor, background: url}) : setNewFloor({...newFloor, background: url})} label="Фоновое изображение этажа" className="mt-2" />
                <div className="mt-3 flex gap-2">
                    {editingFloor ? (
                        <><Button variant="success" size="sm" onClick={async () => { try { await api('PUT', `/api/admin/floors/${editingFloor.id}`, editingFloor); setMessage('Сохранено'); setEditingFloor(null); loadAll(); } catch(e:any) { setMessage(e.message); } }}>Сохранить</Button>
                         <Button variant="danger" size="sm" onClick={() => setEditingFloor(null)}>Отмена</Button></>
                    ) : (
                        <Button variant="success" size="sm" onClick={async () => { try { await api('POST', '/api/admin/floors', newFloor); setMessage('Создано'); loadAll(); setNewFloor({ name: '', background: '', sort_order: 0 }); } catch(e:any) { setMessage(e.message); } }}>Создать</Button>
                    )}
                </div>
            </Card>
            <Card><h3 className="font-bold mb-2">Этажи ({floors.length})</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {floors.map((f: any) => (
                        <div key={f.id} className="relative rounded-lg overflow-hidden border border-[var(--color-border-default)] cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                            onClick={() => setEditingFloor(f)}
                            style={f.background ? { backgroundImage: `url(${f.background})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '80px' } : { minHeight: '60px', background: 'var(--color-bg-input)' }}>
                            {f.background && <div className="absolute inset-0 bg-black/50" />}
                            <div className="relative z-10 p-2 text-center text-xs font-bold">{f.name}</div>
                        </div>
                    ))}
                </div>
            </Card>
        </>
    );

    return (
        <div>
            <div className="flex gap-2 mb-4">
                <Button variant={tab==='actions'?'danger':'secondary'} size="sm" onClick={()=>setTab('actions')}>Действия</Button>
                <Button variant={tab==='mobs'?'danger':'secondary'} size="sm" onClick={()=>setTab('mobs')}>Мобы</Button>
                <Button variant={tab==='floors'?'danger':'secondary'} size="sm" onClick={()=>setTab('floors')}>Этажи</Button>
            </div>
            {tab === 'actions' ? renderActionsTab() : tab === 'mobs' ? renderMobsTab() : renderFloorsTab()}
            {message && <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{message}</div>}
        </div>
    );
}
