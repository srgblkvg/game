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
    const [message, setMessage] = useState('');
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

    const formatTime = (iso: string) => new Date(iso + 'Z').toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Icon icon="game-icons:crossed-swords" width="22" height="22" className="text-[var(--color-war-active-text)]" />
                ⚔️ Война гильдий
            </h1>

            {/* Счёт */}
            <Card className="mb-4 text-center">
                <div className="flex items-center justify-center gap-4 text-lg font-bold">
                    <span>{data.myGuild.name}</span>
                    <span className="text-2xl">{myScore} : {enemyScore}</span>
                    <span>{data.enemyGuild.name}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Окончание: {formatTime(data.expiresAt)}
                </p>
            </Card>

            {error && <p className="text-[var(--color-accent-danger)] text-sm mb-3">{error}</p>}
            {message && <p className="text-[var(--color-accent-success)] text-sm mb-3">{message}</p>}

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
            <div className="text-xs text-[var(--color-text-muted)] mb-4 flex gap-4 flex-wrap">
                <span>Мои атаки: {data.myAttackCount}/3</span>
                {data.attackCooldownUntil && (
                    <span className="text-[var(--color-accent-warning)]">Кулдаун до: {formatTime(data.attackCooldownUntil)}</span>
                )}
                {data.canAttack && <span className="text-[var(--color-accent-success)]">Можно атаковать</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Вражеская гильдия */}
                <div>
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-1">
                        <Icon icon="game-icons:death-skull" width="16" height="16" className="text-[var(--color-war-active-text)]" />
                        {data.enemyGuild.name}
                    </h3>
                    <div className="space-y-1">
                        {data.enemyMembers.map((m: any) => {
                            const hasProtection = !!m.protectedUntil;
                            const maxAttacks = m.timesAttacked >= 3;
                            const cantAttack = hasProtection || maxAttacks || !data.canAttack;
                            return (
                                <Card key={m.id} className="flex items-center justify-between py-2 px-3">
                                    <div>
                                        <span className="text-xs text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                            onClick={() => navigate(`/profile/${m.id}`)}>
                                            {m.username}
                                        </span>
                                        <span className="text-[var(--color-text-muted)] text-[0.6rem] ml-1">ур.{m.level}</span>
                                        {hasProtection && (
                                            <span className="text-[0.55rem] text-[var(--color-accent-info)] ml-1">🛡️ защита</span>
                                        )}
                                        {maxAttacks && (
                                            <span className="text-[0.55rem] text-[var(--color-text-muted)] ml-1">{m.timesAttacked}/3</span>
                                        )}
                                    </div>
                                    <Button
                                        variant="danger"
                                        size="xs"
                                        disabled={cantAttack}
                                        onClick={() => handleAttack(m.id, m.username)}
                                    >
                                        ⚔️
                                    </Button>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Моя гильдия */}
                <div>
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-1">
                        <Icon icon="game-icons:shield" width="16" height="16" className="text-[var(--color-accent-info)]" />
                        {data.myGuild.name}
                    </h3>
                    <div className="space-y-1">
                        {data.myMembers.map((m: any) => (
                            <Card key={m.id} className="flex items-center justify-between py-2 px-3">
                                <div>
                                    <span className="text-xs text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                        onClick={() => navigate(`/profile/${m.id}`)}>
                                        {m.username}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] text-[0.6rem] ml-1">ур.{m.level}</span>
                                </div>
                                <span className="text-[0.6rem] text-[var(--color-text-muted)]">
                                    ⚔️{Math.min(m.attacksMade, 3)}/3
                                </span>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>

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
