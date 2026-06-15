import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { renderBattleLog } from '../utils/battleLog';
import Card from '../components/ui/Card';
import BackButton from '../components/BackButton';
import { fmtSafeDate } from '../utils/date';

function countdown(until: string | null, now: number): string {
    if (!until) return '';
    const sec = Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000));
    if (sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export default function GuildWarPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'enemies' | 'allies'>('enemies');
    const [battleLog, setBattleLog] = useState<any[]>([]);
    const [battleResult, setBattleResult] = useState<any>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);
    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(iv);
    }, []);

    const api = async (url: string, body?: any) => {
        const r = await fetch(`${BASE_URL}${url}`, { method: body ? 'POST' : 'GET', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
    };

    const load = async () => {
        try {
            const d = await api('/guild/war/details');
            setData(d.war);
        } catch (e: any) { setError(e.message); }
    };

    const handleAttack = async (targetId: number, targetName: string) => {
        if (!confirm(`Атаковать ${targetName}?`)) return;
        try {
            const d = await api('/guild/war/attack', { targetId });
            setBattleLog(d.log || d.steps || []);
            setBattleResult(d);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const viewBattleLog = (attack: any) => {
        try {
            const log = JSON.parse(attack.battleLog || '[]');
            setBattleLog(log);
            setBattleResult({ won: attack.won });
        } catch {
            setBattleLog(['Лог боя недоступен']);
            setBattleResult(null);
        }
    };

    if (!data) {
        return (
            <div className="px-4 py-4 max-w-3xl mx-auto">
                <BackButton />
                {error ? <p className="text-[var(--color-accent-danger)]">{error}</p> : <p className="text-[var(--color-text-muted)]">Нет активной войны</p>}
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate('/guild')}>← К гильдии</Button>
            </div>
        );
    }

    const myScore = data.myGuildId === data.attackerGuildId ? data.attackerScore : data.defenderScore;
    const enemyScore = data.myGuildId === data.attackerGuildId ? data.defenderScore : data.attackerScore;
    const attackCd = countdown(data.attackCooldownUntil, now);

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Icon icon="game-icons:crossed-swords" width="22" height="22" style={{color: 'var(--color-war-active-text)'}} />
                ⚔️ Поле битвы
            </h1>

            {/* Счёт */}
            <Card className="mb-4">
                <div className="flex items-center justify-between text-center">
                    <div className="flex-1">
                        <p className="text-sm font-bold">{data.myGuild.name}</p>
                    </div>
                    <div className="flex items-center gap-2 px-4">
                        <span className="text-2xl font-bold">{myScore}</span>
                        <span className="text-lg text-[var(--color-text-muted)]">:</span>
                        <span className="text-2xl font-bold">{enemyScore}</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold">{data.enemyGuild.name}</p>
                    </div>
                </div>
                <p className="text-[0.6rem] text-[var(--color-text-muted)] text-center mt-1">
                    Окончание: {fmtSafeDate(data.expiresAt, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </p>
            </Card>

            {error && <p className="text-[var(--color-accent-danger)] text-sm mb-3">{error}</p>}

            {/* Боевой лог */}
            {battleLog.length > 0 && (
                <Card className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm">
                            {battleResult?.won ? '🏆 Победа!' : battleResult?.won === false ? '💀 Поражение' : '📋 Лог боя'}
                        </h3>
                        <Button variant="secondary" size="xs" onClick={() => { setBattleLog([]); setBattleResult(null); }}>✕</Button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {renderBattleLog(battleLog)}
                    </div>
                </Card>
            )}

            {/* Инфо о кулдауне и лимитах */}
            <div className="text-xs text-[var(--color-text-muted)] mb-3 flex gap-4 flex-wrap items-center">
                <span>Мои атаки: {data.myAttackCount}/3</span>
                {attackCd && (
                    <span className="text-[var(--color-accent-warning)] font-bold">⚔️ Кулдаун: {attackCd}</span>
                )}
                {!attackCd && data.myAttackCount >= 3 && (
                    <span className="text-[var(--color-accent-danger)]">Лимит атак исчерпан</span>
                )}
                {!attackCd && data.myAttackCount < 3 && (
                    <span className="text-[var(--color-accent-success)]">Можно атаковать</span>
                )}
            </div>

            {/* Вкладки */}
            <div className="flex border-b border-[var(--color-border-light)] mb-3">
                <button
                    onClick={() => setTab('enemies')}
                    className={`px-3 py-1 text-xs cursor-pointer border-b-2 transition-colors ${
                        tab === 'enemies'
                            ? 'border-[var(--color-accent-danger)] text-[var(--color-accent-danger)] font-bold'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    ⚔️ Враги
                </button>
                <button
                    onClick={() => setTab('allies')}
                    className={`px-3 py-1 text-xs cursor-pointer border-b-2 transition-colors ${
                        tab === 'allies'
                            ? 'border-[var(--color-accent-info)] text-[var(--color-accent-info)] font-bold'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    🛡️ Союзники
                </button>
            </div>

            {/* Враги */}
            {tab === 'enemies' && (
                <div className="space-y-1">
                    {data.enemyMembers.map((m: any) => {
                        const protCd = countdown(m.protectedUntil, now);
                        const myLimit = data.myAttackCount >= 3;
                        const defLimit = (m.timesAttacked || 0) >= 3;
                        const hasCooldown = !!attackCd;
                        const cantAttack = !!protCd || defLimit || myLimit || hasCooldown;
                        return (
                            <Card key={m.id} className="flex items-center justify-between py-2 px-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                        onClick={() => navigate(`/profile/${m.id}`)}>
                                        {m.username}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] text-[0.6rem]">ур.{m.level}</span>
                                    <span className="text-[0.55rem] text-[var(--color-text-muted)]">{m.timesAttacked || 0}/3</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {protCd && (
                                        <span className="text-[0.55rem] text-[var(--color-accent-info)]">🛡️{protCd}</span>
                                    )}
                                    <Button
                                        variant="danger"
                                        size="xs"
                                        disabled={cantAttack}
                                        onClick={() => handleAttack(m.id, m.username)}
                                    >
                                        {hasCooldown ? `⏳${attackCd}` : protCd ? "🛡️" : myLimit ? '⛔' : defLimit ? '🔒' : '⚔️'}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Союзники */}
            {tab === 'allies' && (
                <div className="space-y-1">
                    {data.myMembers.map((m: any) => (
                        <Card key={m.id} className="flex items-center justify-between py-2 px-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                    onClick={() => navigate(`/profile/${m.id}`)}>
                                    {m.username}
                                </span>
                                <span className="text-[var(--color-text-muted)] text-[0.6rem]">ур.{m.level}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[0.6rem]">
                                <span className="text-[var(--color-accent-success)]">{m.attacksWon || 0}🏆</span>
                                <span className="text-[var(--color-accent-danger)]">{m.attacksLost || 0}💀</span>
                                <span className="text-[var(--color-text-muted)]">{m.attacksMade || 0}/3</span>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Ход войны — все атаки */}
            {data.allAttacks && data.allAttacks.length > 0 && (
                <Card className="mt-4">
                    <h3 className="font-bold text-sm mb-2">📜 Ход войны</h3>
                    <div className="space-y-1 text-xs">
                        {data.allAttacks.map((a: any) => {
                            const isMyGuild = a.attackerGuildId === data.myGuildId;
                            return (
                                <div key={a.id}
                                    className="flex items-center gap-2 border-b border-[var(--color-border-light)] pb-1 cursor-pointer hover:bg-[var(--color-bg-card-hover)] px-1 rounded"
                                    onClick={() => viewBattleLog(a)}
                                >
                                    <span>{a.won ? '🏆' : '💀'}</span>
                                    <span className={isMyGuild ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}>
                                        {a.attackerName}
                                    </span>
                                    <span className="text-[var(--color-text-muted)]">vs</span>
                                    <span>{a.defenderName}</span>
                                    <span className="text-[var(--color-text-muted)] ml-auto text-[0.6rem]">
                                        {fmtSafeDate(a.createdAt, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}
