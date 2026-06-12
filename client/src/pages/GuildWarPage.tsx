import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import BackButton from '../components/BackButton';

export default function GuildWarPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'enemies' | 'allies'>('enemies');
    const [battleLog, setBattleLog] = useState<string[]>([]);
    const [battleResult, setBattleResult] = useState<any>(null);

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

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
            setBattleLog(d.log);
            setBattleResult(d);
            load();
        } catch (e: any) { setError(e.message); }
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
    const formatTime = (iso: string) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    };

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Icon icon="game-icons:crossed-swords" width="22" height="22" style={{color: 'var(--color-war-active-text)'}} />
                ⚔️ Война гильдий
            </h1>

            {/* Счёт — горизонтальный блок */}
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
                    Окончание: {formatTime(data.expiresAt)}
                </p>
            </Card>

            {error && <p className="text-[var(--color-accent-danger)] text-sm mb-3">{error}</p>}

            {/* Боевой лог */}
            {battleLog.length > 0 && (
                <Card className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm">
                            {battleResult?.won ? '🏆 Победа!' : '💀 Поражение'}
                        </h3>
                        <Button variant="secondary" size="xs" onClick={() => { setBattleLog([]); setBattleResult(null); }}>✕</Button>
                    </div>
                    <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                        {battleLog.map((line, i) => (
                            <p key={i} className="text-[var(--color-text-muted)]">{line}</p>
                        ))}
                    </div>
                </Card>
            )}

            {/* Инфо о кулдауне и лимитах */}
            <div className="text-xs text-[var(--color-text-muted)] mb-3 flex gap-4 flex-wrap">
                <span>Мои атаки: {data.myAttackCount}/3</span>
                {data.attackCooldownUntil && (
                    <span className="text-[var(--color-accent-warning)]">Кулдаун до: {formatTime(data.attackCooldownUntil)}</span>
                )}
                {data.canAttack && <span className="text-[var(--color-accent-success)]">Можно атаковать</span>}
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
                        const hasProtection = !!m.protectedUntil;
                        const maxAttacks = m.timesAttacked >= 3;
                        const cantAttack = hasProtection || maxAttacks || !data.canAttack;
                        return (
                            <Card key={m.id} className="flex items-center justify-between py-2 px-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                        onClick={() => navigate(`/profile/${m.id}`)}>
                                        {m.username}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] text-[0.6rem]">ур.{m.level}</span>
                                    {hasProtection && (
                                        <span className="text-[0.55rem] text-[var(--color-accent-info)]">🛡️</span>
                                    )}
                                    <span className="text-[0.55rem] text-[var(--color-text-muted)]">{m.timesAttacked}/3</span>
                                </div>
                                <Button variant="danger" size="xs" disabled={cantAttack} onClick={() => handleAttack(m.id, m.username)}>
                                    ⚔️
                                </Button>
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
                                <span className="text-[var(--color-text-muted)]">({m.attacksWon||0}/{m.attacksLost||0}/{m.attacksMade||0})</span>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* История моих атак */}
            {data.myAttacks.length > 0 && (
                <Card className="mt-4">
                    <h3 className="font-bold text-sm mb-2">Мои атаки</h3>
                    <div className="space-y-1 text-xs">
                        {data.myAttacks.map((a: any) => (
                            <div key={a.id} className="flex items-center gap-2 border-b border-[var(--color-border-light)] pb-1">
                                <span>{a.won ? '🏆' : '💀'}</span>
                                <span>vs {a.defenderName}</span>
                                <span className="text-[var(--color-text-muted)] ml-auto">{new Date(a.createdAt + 'Z').toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
