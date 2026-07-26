import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function GuildRatingPage() {
    const { user } = useAuth();
    const { character } = useGame();
    const navigate = useNavigate();
    const [guilds, setGuilds] = useState<any[]>([]);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [myGuild, setMyGuild] = useState<any>(null);
    const [myMembers, setMyMembers] = useState<any[]>([]);
    const [myWar, setMyWar] = useState<any>(null);

    useEffect(() => { if (!user) navigate('/login');
        fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() })
            .then(r => r.json()).then(setGuilds).catch(() => {});
        fetch(`${BASE_URL}/guild/my`, { headers: getHeaders() })
            .then(r => r.json()).then(d => { if (d.guild) { setMyGuild(d.guild); setMyMembers(d.members || []); setMyWar(d.war || null); } }).catch(() => {});
    }, [user]);

    const myGuildId = character?.guildId;

    const canDeclare = (g: any) => {
        if (!myGuild) return false;
        if (g.id === myGuildId) return false;
        if (myGuild.myRank !== 'leader' && myGuild.myRank !== 'officer') return false;
        if (myGuild.myRank === 'officer') {
            const me = myMembers.find((m: any) => m.userId === user?.id);
            if (!me?.can_war) return false;
        }
        if (myWar) return false;
        if (g.warStatus) return false;
        return true;
    };

    const [warTarget, setWarTarget] = useState<any>(null);

    const handleDeclare = async (g: any) => {
        setWarTarget(g);
    };

    const toggle = (id: number) => {
        setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Рейтинг гильдий</h1>
            {guilds.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет гильдий</p>
            ) : (
                guilds.map((g: any, i) => {
                    const isMyGuild = myGuildId && g.id === myGuildId;
                    const rank = i + 1;
                    const isExpanded = expanded.has(g.id);
                    return (
                    <Card key={g.id} className={`mb-2 ${isMyGuild ? 'border-[var(--color-accent-success)] bg-[var(--color-accent-success)]/10' : ''}`}>
                        <div
                            className="flex justify-between items-start cursor-pointer select-none"
                            onClick={() => toggle(g.id)}
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
                                <span className="text-sm font-bold w-8 text-center text-[var(--color-text-muted)]">#{rank}</span>
                                {g.image && <img src={g.image} alt="" className="w-5 h-5 object-contain rounded flex-shrink-0" />}
                                <h4 className="font-bold text-sm truncate">{g.name}</h4>
                                {g.warStatus && (
                                    <span className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold"
                                        style={{
                                            color: g.warStatus === 'active' ? 'var(--color-war-active-text)' : 'var(--color-war-pending-text)',
                                            backgroundColor: g.warStatus === 'active' ? 'var(--color-war-active-bg)' : 'var(--color-war-pending-bg)',
                                        }}>
                                        ⚔️
                                    </span>
                                )}
                                {isMyGuild && (
                                    <span className="text-[0.6rem] text-[var(--color-accent-success)] font-bold px-1.5 py-0.5 rounded border border-[var(--color-accent-success)]">Ваша</span>
                                )}
                            </div>
                            {canDeclare(g) && (
                                <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDeclare(g); }}>
                                    ⚔️ Война
                                </Button>
                            )}
                        </div>
                        {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-3 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/guild/${g.id}`)}>
                                        {(g.image || g.description) ? (
                                            <div className="flex-shrink-0 border-2 border-[var(--color-accent-gold)] rounded-lg p-2 bg-[var(--color-bg-card)]" style={{ minWidth: 80, maxWidth: 120 }}>
                                                {g.image && <img src={g.image} alt="Герб" className="w-full h-auto object-contain rounded mb-1" />}
                                                {g.description && <p className="text-[0.6rem] text-[var(--color-text-secondary)] italic text-center leading-tight">{'«'}{g.description}{'»'}</p>}
                                            </div>
                                        ) : null}
                                        <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
                                            <p>Уровень: {g.level}</p>
                                            <p>Участники: {g.memberCount}/20</p>
                                            <p>
                                                Лидер:{' '}
                                                <span
                                                    className="text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/profile/${g.leaderuserId}`); }}
                                                >
                                                    👑 {g.leaderName}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {g.warStatus && (
                                    <div className="mt-1.5 text-xs rounded p-1.5"
                                        style={{
                                            color: 'var(--color-war-active-text)',
                                            backgroundColor: 'var(--color-war-active-bg)',
                                        }}>
                                        ⚔️ {g.warStatus === 'active' ? 'Воюет с' : 'Ожидает ответа от'} «{g.warOpponent}»
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                    );
                })
            )}
            {/* Модалка подтверждения войны */}
            {warTarget && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setWarTarget(null)}>
                    <Card className="max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-3 text-center">⚔️ Объявить войну</h3>
                        <p className="text-sm mb-2">Противник: <span className="font-bold text-[var(--color-accent-danger)]">{warTarget.name}</span></p>
                        <div className="text-xs text-[var(--color-text-muted)] space-y-1.5 mb-4">
                            <p className="font-bold text-[var(--color-text-primary)]">Как проходит война:</p>
                            <p>• ⏳ <b>24 часа</b> на ответ противника</p>
                            <p>• ⚔️ После принятия — <b>24 часа</b> боёв</p>
                            <p>• 🛡️ Каждый участник может быть атакован до <b>5 раз</b></p>
                            <p>• ⚔️ Каждый участник может атаковать до <b>3 раз</b></p>
                            <p>• 🏆 Побеждает гильдия с наибольшим счётом</p>
                            <p className="font-bold text-[var(--color-accent-warning)] mt-1">⚠️ Ограничения:</p>
                            <p>• 💰 Казна заморожена до конца войны</p>
                            <p>• 🚫 Нельзя покинуть гильдию</p>
                            <p>• 📛 Нельзя исключать участников</p>
                            <p>• 🚷 Нельзя принять новых участников</p>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <Button variant="secondary" size="md" onClick={() => setWarTarget(null)}>Отмена</Button>
                            <Button variant="danger" size="md" onClick={async () => {
                                setWarTarget(null);
                                try {
                                    const r = await fetch(`${BASE_URL}/guild/war/declare`, {
                                        method: 'POST',
                                        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ targetGuildId: warTarget.id }),
                                    });
                                    const d = await r.json();
                                    if (!r.ok) { alert(d.error); return; }
                                    navigate('/guild');
                                } catch {}
                            }}>⚔️ Объявить войну</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
