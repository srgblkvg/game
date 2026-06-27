import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { getHeaders, BASE_URL } from '../api/helpers';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

interface PlayerInfo {
    id: number; username: string; level: number;
    base: { s: number; a: number; d: number; m: number };
    stats: { s: number; a: number; d: number; m: number; hp: number; bonuses: any; extra: any; drinks: any; collection: number };
    statsWithoutGuild?: { s: number; a: number; d: number; m: number; hp: number; bonuses: any; extra: any; drinks: any; collection: number };
    collectionBonus: number; drinkBonuses: any;
    guildBonus?: number;
    guildId?: number | null;
    context?: string;
    contextLabel?: string;
}

interface Suggestion { id: number; username: string; level: number; }

interface BattleResult {
    num: number; attackerName: string; defenderName: string;
    winnerName: string; winnerId: number; effects: number;
    steps: { type: string; message: string; hA?: number; hD?: number; aName?: string; dName?: string }[];
}

type BattleContext = 'arena' | 'tournament' | 'war_attack' | 'war_defense';

const CONTEXTS: { value: BattleContext; label: string; icon: string }[] = [
    { value: 'arena', label: 'Арена', icon: 'game-icons:crossed-swords' },
    { value: 'tournament', label: 'Турнир', icon: 'game-icons:trophy' },
    { value: 'war_attack', label: 'Война гильдий (атака)', icon: 'game-icons:battered-axe' },
    { value: 'war_defense', label: 'Война гильдий (защита)', icon: 'game-icons:shield' },
];

export default function BattleSimPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    if (user?.role !== 'player' && user?.role !== 'admin') { navigate('/'); return null; }

    const [p1Input, setP1Input] = useState('');
    const [p2Input, setP2Input] = useState('');
    const [p1, setP1] = useState<PlayerInfo | null>(null);
    const [p2, setP2] = useState<PlayerInfo | null>(null);
    const [context, setContext] = useState<BattleContext>('arena');
    const [suggestions, setSuggestions] = useState<{ p1: Suggestion[]; p2: Suggestion[] }>({ p1: [], p2: [] });
    const [battleCount, setBattleCount] = useState(100);
    const [battles, setBattles] = useState<BattleResult[]>([]);
    const [summary, setSummary] = useState<{ wins1: number; wins2: number; avgEffects: number; contextLabel: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openBattle, setOpenBattle] = useState<number | null>(null);

    const p1Ref = useRef<HTMLDivElement>(null);
    const p2Ref = useRef<HTMLDivElement>(null);

    // Autocomplete search
    useEffect(() => {
        if (p1Input.length < 2) { setSuggestions(s => ({ ...s, p1: [] })); return; }
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`${BASE_URL}/players/search?q=${encodeURIComponent(p1Input)}`, { headers: getHeaders() });
                const d = await r.json();
                if (Array.isArray(d)) setSuggestions(s => ({ ...s, p1: d }));
            } catch {}
        }, 200);
        return () => clearTimeout(t);
    }, [p1Input]);

    useEffect(() => {
        if (p2Input.length < 2) { setSuggestions(s => ({ ...s, p2: [] })); return; }
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`${BASE_URL}/players/search?q=${encodeURIComponent(p2Input)}`, { headers: getHeaders() });
                const d = await r.json();
                if (Array.isArray(d)) setSuggestions(s => ({ ...s, p2: d }));
            } catch {}
        }, 200);
        return () => clearTimeout(t);
    }, [p2Input]);

    const selectPlayer = async (num: 1 | 2, s: Suggestion) => {
        if (num === 1) { setP1Input(s.username); setSuggestions(s => ({ ...s, p1: [] })); }
        else { setP2Input(s.username); setSuggestions(s => ({ ...s, p2: [] })); }
        try {
            const r = await fetch(`${BASE_URL}/players/${s.id}/loadout?context=${context}`, { headers: getHeaders() });
            const d = await r.json();
            if (num === 1) setP1(d); else setP2(d);
        } catch (e: any) { setError(e.message); }
    };

    // Reload player info when context changes
    useEffect(() => {
        const reload = async () => {
            if (p1) {
                try {
                    const r = await fetch(`${BASE_URL}/players/${p1.id}/loadout?context=${context}`, { headers: getHeaders() });
                    const d = await r.json();
                    setP1(d);
                } catch {}
            }
            if (p2) {
                try {
                    const r = await fetch(`${BASE_URL}/players/${p2.id}/loadout?context=${context}`, { headers: getHeaders() });
                    const d = await r.json();
                    setP2(d);
                } catch {}
            }
        };
        reload();
    }, [context]);

    const runSim = async () => {
        if (!p1 || !p2) return;
        setLoading(true); setError(''); setBattles([]); setSummary(null);
        try {
            const r = await fetch(`${BASE_URL}/battle-sim`, {
                method: 'POST', headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ id1: p1.id, id2: p2.id, battles: battleCount, context }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setBattles(d.battles);
            setSummary({ wins1: d.wins1, wins2: d.wins2, avgEffects: d.avgEffects, contextLabel: d.contextLabel });
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    // Click outside to close suggestions
    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (p1Ref.current && !p1Ref.current.contains(e.target as Node)) setSuggestions(s => ({ ...s, p1: [] }));
            if (p2Ref.current && !p2Ref.current.contains(e.target as Node)) setSuggestions(s => ({ ...s, p2: [] }));
        };
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    const dmgRange = (S: number, level: number) => ({ min: level, med: Math.round(level + 0.7 * (S - level)), max: S });
    const critM = (m: number) => 1.5 + 0.5 * (m / (m + 50));
    const bC = (d: number, extraFB: number) => Math.min(1, d / (d + 500) + extraFB / 300);
    const bR = (d: number, s: number) => Math.min(0.75, 0.5 * (d / Math.max(1, s)));
    const dC = (a: number, ed: number) => Math.max(0, Math.min(0.95, a / (a + 500) + ed / 300));
    const cC = (m: number, ec: number) => Math.min(0.8, m / (m + 500) + ec / 300);
    const fB = (efb: number) => Math.min(1, efb / 300);

    const renderPlayerCard = (p: PlayerInfo) => {
        if (!p) return <Card className="p-3 text-center text-sm text-[var(--color-text-muted)]">Игрок не выбран</Card>;
        const st = p.stats;
        const dmg = dmgRange(st.s, p.level);
        const cm = critM(st.m);
        const medCrit = Math.round(dmg.med * cm);
        const extraFB = st.extra?.fullBlock || 0;
        const extraDodge = st.extra?.dodge || 0;
        const extraCrit = st.extra?.crit || 0;
        const blockPct = Math.round(bC(st.d, extraFB) * 100);
        const blockAmt = Math.round(bR(st.d, st.s) * 100);
        const dodgePct = Math.round(dC(st.a, extraDodge) * 100);
        const critPct = Math.round(cC(st.m, extraCrit) * 100);
        const fullBPct = Math.round(fB(extraFB) * 100);

        const guildPct = p.guildBonus ? `+${p.guildBonus}%` : null;

        return (
            <Card className="p-3 text-xs">
                <h3 className="text-sm font-bold text-[var(--color-accent-purple)] mb-2">
                    {p.username} (ур.{p.level})
                    {p.guildId && <span className="text-[var(--color-accent-warning)] ml-1">🏰</span>}
                </h3>
                <table className="w-full border-collapse">
                    <thead><tr className="text-[var(--color-text-muted)]">
                        <td></td><td className="text-right">S</td><td className="text-right">A</td><td className="text-right">D</td><td className="text-right">M</td><td className="text-right">HP</td>
                    </tr></thead>
                    <tbody>
                        <tr><td>База</td><td className="text-right">{p.base.s}</td><td className="text-right">{p.base.a}</td><td className="text-right">{p.base.d}</td><td className="text-right">{p.base.m}</td><td className="text-right">{p.base.s+p.base.a+p.base.d+p.base.m}</td></tr>
                        <tr className="text-[var(--color-accent-success)]"><td>+ Экип</td><td className="text-right">{st.bonuses?.s||0}</td><td className="text-right">{st.bonuses?.a||0}</td><td className="text-right">{st.bonuses?.d||0}</td><td className="text-right">{st.bonuses?.m||0}</td><td className="text-right">{(st.bonuses?.s||0)+(st.bonuses?.a||0)+(st.bonuses?.d||0)+(st.bonuses?.m||0)}</td></tr>
                        <tr className="text-[var(--color-accent-warning)]"><td>+ Напитки</td><td className="text-right">{st.drinks?.s||0}</td><td className="text-right">{st.drinks?.a||0}</td><td className="text-right">{st.drinks?.d||0}</td><td className="text-right">{st.drinks?.m||0}</td><td className="text-right">{(st.drinks?.s||0)+(st.drinks?.a||0)+(st.drinks?.d||0)+(st.drinks?.m||0)}</td></tr>
                        <tr className="text-[var(--color-accent-purple)]"><td>× Колл ({st.collection||0})</td><td colSpan={4} className="text-right">{st.collection>0?`×${(1+st.collection/100).toFixed(2)}`:''}</td><td className="text-right">{st.collection>0?`+${st.collection}%`:''}</td></tr>
                        {guildPct && (
                            <tr className="text-[var(--color-accent-warning)]"><td>× Гильдия ({guildPct})</td><td colSpan={4} className="text-right">×{(1+(p.guildBonus||0)/100).toFixed(2)}</td><td className="text-right">{guildPct}</td></tr>
                        )}
                        <tr className="font-bold border-t border-[var(--color-border-default)]"><td>ИТОГО</td><td className="text-right">{st.s}</td><td className="text-right">{st.a}</td><td className="text-right">{st.d}</td><td className="text-right">{st.m}</td><td className="text-right text-[var(--color-accent-pink)]">{st.hp}</td></tr>
                        {p.statsWithoutGuild && (
                            <tr className="text-[var(--color-text-muted)] text-[10px]"><td>Без гильдии</td><td className="text-right">{p.statsWithoutGuild.s}</td><td className="text-right">{p.statsWithoutGuild.a}</td><td className="text-right">{p.statsWithoutGuild.d}</td><td className="text-right">{p.statsWithoutGuild.m}</td><td className="text-right">{p.statsWithoutGuild.hp}</td></tr>
                        )}
                    </tbody>
                </table>
                <div className="mt-2 text-[var(--color-text-muted)]">
                    <div>⚔ Урон: <b className="text-[var(--color-text-primary)]">{dmg.min} – {dmg.med} – {dmg.max}</b> | Крит ×{cm.toFixed(2)} (медиана {medCrit}) | Шанс крита: <b>{critPct}%</b></div>
                    <div>🛡 Блок: <b>{blockPct}%</b> (−{blockAmt}%) | Полный блок: <b>{fullBPct}%</b> | Уклон: <b>{dodgePct}%</b></div>
                    <div>Экстра: crit+{st.extra?.crit||0} dodge+{st.extra?.dodge||0} counter+{st.extra?.counter||0} fullBlock+{st.extra?.fullBlock||0}</div>
                </div>
            </Card>
        );
    };

    const ctx = CONTEXTS.find(c => c.value === context)!;

    return (
        <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:crossed-swords" width="22" height="22" className="inline mr-2"/>Симулятор боёв</h1>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div ref={p1Ref} className="relative">
                    <input value={p1Input} onChange={e => { setP1Input(e.target.value); setP1(null); }}
                        placeholder="Игрок 1..." className="w-full p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-sm" />
                    {suggestions.p1.length > 0 && (
                        <div className="absolute z-50 w-full bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded mt-1 max-h-40 overflow-y-auto">
                            {suggestions.p1.map(s => (
                                <div key={s.id} onClick={() => selectPlayer(1, s)}
                                    className="p-2 cursor-pointer hover:bg-[var(--color-bg-secondary)] text-sm flex justify-between">
                                    <span>{s.username}</span><span className="text-[var(--color-text-muted)]">ур.{s.level}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div ref={p2Ref} className="relative">
                    <input value={p2Input} onChange={e => { setP2Input(e.target.value); setP2(null); }}
                        placeholder="Игрок 2..." className="w-full p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-sm" />
                    {suggestions.p2.length > 0 && (
                        <div className="absolute z-50 w-full bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded mt-1 max-h-40 overflow-y-auto">
                            {suggestions.p2.map(s => (
                                <div key={s.id} onClick={() => selectPlayer(2, s)}
                                    className="p-2 cursor-pointer hover:bg-[var(--color-bg-secondary)] text-sm flex justify-between">
                                    <span>{s.username}</span><span className="text-[var(--color-text-muted)]">ур.{s.level}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Location / Context selector */}
            <div className="mb-4">
                <span className="text-sm mr-2 text-[var(--color-text-muted)]">Локация:</span>
                <div className="inline-flex gap-1 flex-wrap">
                    {CONTEXTS.map(c => (
                        <button key={c.value}
                            onClick={() => setContext(c.value)}
                            className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                                context === c.value
                                    ? 'bg-[var(--color-accent-purple)] text-white border-[var(--color-accent-purple)]'
                                    : 'bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)]'
                            }`}
                        >
                            <Icon icon={c.icon} width="14" height="14" className="inline mr-1"/>{c.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {renderPlayerCard(p1!)}
                {renderPlayerCard(p2!)}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <span className="text-sm">Боёв:</span>
                <input type="number" value={battleCount} onChange={e => setBattleCount(parseInt(e.target.value) || 100)}
                    min={1} max={500} className="w-20 p-1.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-sm text-center" />
                <Button variant="primary" size="sm" onClick={runSim} disabled={!p1 || !p2 || loading}>
                    {loading ? 'Симуляция...' : 'Запустить'}
                </Button>
            </div>

            {error && <p className="text-[var(--color-accent-danger)] text-sm mb-3">{error}</p>}

            {summary && (
                <Card className="p-4 mb-4">
                    <h3 className="font-bold mb-2">
                        <Icon icon={ctx.icon} width="16" height="16" className="inline mr-1"/>
                        Результаты ({battleCount} боёв) — {summary.contextLabel}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><b>{p1?.username}</b>: побед <span className="text-[var(--color-accent-success)]">{summary.wins1}</span> ({(summary.wins1/battleCount*100).toFixed(1)}%)</div>
                        <div><b>{p2?.username}</b>: побед <span className="text-[var(--color-accent-success)]">{summary.wins2}</span> ({(summary.wins2/battleCount*100).toFixed(1)}%)</div>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">⚡ Среднее эффектов: {summary.avgEffects.toFixed(1)}</p>
                </Card>
            )}

            {battles.length > 0 && (
                <div>
                    {battles.map(b => (
                        <div key={b.num} className="mb-1">
                            <div onClick={() => setOpenBattle(openBattle === b.num ? null : b.num)}
                                className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded cursor-pointer flex justify-between items-center text-sm hover:bg-[var(--color-bg-secondary)]">
                                <span>⚔ <b>Битва {b.num}</b> — {b.attackerName} ⚔ {b.defenderName}</span>
                                <span className="flex items-center gap-3">
                                    <span className={b.winnerId === p1?.id ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}>{b.winnerName}</span>
                                    <span className="text-xs text-[var(--color-text-muted)]">эффектов: {b.effects}</span>
                                    <span className="text-xs">{openBattle === b.num ? '▼' : '▶'}</span>
                                </span>
                            </div>
                            {openBattle === b.num && (
                                <div className="bg-[var(--color-bg-primary)] border-x border-b border-[var(--color-border-default)] rounded-b p-2 text-xs max-h-80 overflow-y-auto">
                                    {b.steps.reduce((acc: any[], s, i) => {
                                        const prev = b.steps[i - 1];
                                        const isNewTurn = s.type === 'attack';
                                        const isEnd = s.type === 'end';
                                        if (isNewTurn && prev && prev.type !== 'info' && prev.type !== 'info') {
                                            acc.push({ type: 'divider' });
                                        }
                                        if (isEnd && prev) {
                                            acc.push({ type: 'divider' });
                                        }
                                        acc.push(s);
                                        return acc;
                                    }, []).map((s: any, i: number) => {
                                        if (s.type === 'divider') {
                                            return <div key={`d${i}`} className="border-t border-[var(--color-border-default)] my-1.5 opacity-50" />;
                                        }
                                        const colors: Record<string,string> = {
                                            attack:'#f9e2af', dodge:'#89b4fa', counter:'#f5c2e7', crit:'#f38ba8',
                                            block:'#a6e3a1', fullBlock:'#a6e3a1', stun:'#cba6f7', damage:'#f38ba8',
                                            end:'#f9e2af', info:'#6c7086', money:'#f9e2af'
                                        };
                                        const bg = s.type === 'attack'
                                            ? s.actor === 'attacker' ? 'rgba(249,226,175,0.06)' : 'rgba(245,194,231,0.06)'
                                            : undefined;
                                        return (
                                            <div key={i} className="py-0.5 px-1" style={{ color: colors[s.type] || '#6c7086', background: bg }}>
                                                {s.message}
                                                {s.hp1 != null && s.hp2 != null && (
                                                    <span className="text-[var(--color-text-muted)] ml-2">[{s.actor === 'attacker' ? '⚔' : '🛡'}: {s.hp1}/{s.maxHp1} | {s.hp2}/{s.maxHp2}]</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
