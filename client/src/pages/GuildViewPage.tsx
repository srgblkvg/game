import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { fmtSafeDate } from '../utils/date';
import { getLastSeen } from '../utils/time';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function GuildViewPage() {
    const { id } = useParams<{ id: string }>();
    const { user: _user } = useAuth();
    const navigate = useNavigate();

    const [guild, setGuild] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [myGuild, setMyGuild] = useState<any>(null);
    const [myWar, setMyWar] = useState<any>(null);
    const [war, setWar] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { load(); }, [id]);

    const load = async () => {
        try {
            const r = await fetch(`${BASE_URL}/guild/${id}`, { headers: getHeaders() });
            const data = await r.json();
            if (!r.ok) { setMessage(data.error || 'Ошибка'); return; }
            setGuild(data.guild);
            setMembers(data.members);
            setWar(data.war || null);
        } catch { setMessage('Ошибка загрузки'); }

        // Проверяем свою гильдию
        try {
            const r = await fetch(`${BASE_URL}/guild/my`, { headers: getHeaders() });
            const data = await r.json();
            if (data.guild) { setMyGuild(data.guild); setMyWar(data.war || null); }
        } catch {}
        setLoaded(true);
    };

    const api = async (url: string, body?: any) => {
        const r = await fetch(`${BASE_URL}${url}`, { method: body ? 'POST' : 'GET', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
    };

    const handleJoin = async () => {
        try {
            if (guild.joinType === 'open') {
                await api(`/guild/join/${id}`, {});
                setMessage('Вы вступили в гильдию!');
            } else if (guild.joinType === 'request') {
                await api(`/guild/request/${id}`, {});
                setMessage('Заявка отправлена!');
            }
            load();
        } catch (e: any) { setMessage(e.message); }
    };

    const isMember = myGuild && myGuild.id === guild?.id;

    // Условия для кнопки объявления войны:
    // - я лидер своей гильдии
    // - это не моя гильдия
    // - моя гильдия не в войне
    // - целевая гильдия не в войне
    const canDeclareWar = myGuild && myGuild.myRank === 'leader'
        && !isMember
        && !myWar
        && !war;

    const [showWarModal, setShowWarModal] = useState(false);

    const handleDeclareWar = async () => {
        setShowWarModal(true);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}

            {guild && (
                <>
                    <div className="mb-3">
                        <BackButton />
                    </div>
                    <Button variant="secondary" size="md" onClick={() => navigate('/guild/rating')} className="mb-3">
                        ← Рейтинг гильдий
                    </Button>
                    <Card className="mb-4">
                        <div className="flex items-start gap-3">
                            {guild.hasImage && (
                                <img src={`${BASE_URL}/guild/${guild.id}/image`} alt="Герб" className="w-16 h-16 object-cover rounded border-2 border-[var(--color-accent-gold)] flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <h1 className="font-bold text-lg flex items-center gap-2">
                                    🏚️ {guild.name}
                                    <span className="text-xs text-[var(--color-text-muted)] font-normal">ур.{guild.level}</span>
                                </h1>
                                {guild.description && (
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{guild.description}</p>
                                )}
                                <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-muted)] flex-wrap">
                                    <span>👑 {guild.leaderName}</span>
                                    <span>👥 {guild.memberCount}/20 уч.</span>
                                    <span>
                                        {guild.joinType === 'open' ? '🔓 Открытая' : guild.joinType === 'request' ? '📝 По заявке' : '🔒 По приглашению'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {loaded && !isMember && !myGuild && (
                            <div className="mt-3 flex gap-2">
                                <Button variant="primary" size="md" onClick={handleJoin}>
                                    {guild.joinType === 'open' ? 'Вступить' : guild.joinType === 'request' ? 'Подать заявку' : 'Закрыто'}
                                </Button>
                                {canDeclareWar && (
                                    <Button variant="danger" size="md" onClick={handleDeclareWar}>
                                        ⚔️ Объявить войну
                                    </Button>
                                )}
                            </div>
                        )}
                        {isMember && (
                            <div className="mt-3">
                                <Button variant="secondary" size="md" onClick={() => navigate('/guild')}>Управление гильдией</Button>
                            </div>
                        )}
                    </Card>

                    {/* Блок войны */}
                    {war && (
                        <Card className="mb-4 border-l-4 border-l-red-500">
                            <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
                                <Icon icon="game-icons:crossed-swords" width="18" height="18" style={{color: 'var(--color-war-active-text)'}} />
                                ⚔️ Поле битвы
                                <span className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold"
                                    style={{
                                        color: 'var(--color-war-active-text)',
                                        backgroundColor: 'var(--color-war-active-bg)',
                                    }}
                                >
                                    Активна
                                </span>
                            </h3>
                            <div className="text-xs space-y-1">
                                <p>
                                    <span className="text-[var(--color-text-muted)]">Атакующая:</span>{' '}
                                    <span className="text-[var(--color-text-primary)] font-bold">{war.attackerGuild?.name || '???'}</span>
                                </p>
                                <p>
                                    <span className="text-[var(--color-text-muted)]">Защищается:</span>{' '}
                                    <span className="text-[var(--color-text-primary)] font-bold">{war.defenderGuild?.name || '???'}</span>
                                </p>
                                <p className="text-[var(--color-text-muted)]">
                                    Объявлена: {fmtSafeDate(war.declaredAt, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                </p>
                                <p className="text-[var(--color-text-muted)]">
                                    Окончание: {fmtSafeDate(war.expiresAt, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                </p>
                            </div>
                        </Card>
                    )}

                    <Card>
                        <h3 className="font-bold text-sm mb-2">Участники ({members.length}/20)</h3>
                        <div className="space-y-1">
                            {[...members].sort((a: any, b: any) => {
                                const rankOrder = (r: string) => r === 'leader' ? 0 : r === 'officer' ? 1 : 2;
                                const ro = rankOrder(a.rank) - rankOrder(b.rank);
                                if (ro !== 0) return ro;
                                return (b.level || 0) - (a.level || 0);
                            }).map((m: any) => (
                                <div key={m.userId} className="flex justify-between items-center py-1 border-b border-[var(--color-border-light)] text-xs">
                                    <span className="cursor-pointer hover:text-[var(--color-accent-info)]"
                                        onClick={() => navigate(`/profile/${m.userId}`)}>
                                        {m.rank === 'leader' ? '👑' : m.rank === 'officer' ? '🛡️' : '⚔️'} {m.username} ур.{m.level}
                                    </span>
                                    {m.online
                                        ? <span className="text-green-500 dark:text-green-400 whitespace-nowrap font-medium">В игре</span>
                                        : <span className="text-[var(--color-text-muted)] whitespace-nowrap">Был в игре: {getLastSeen(m.lastLoginAt).text}</span>
                                    }
                                </div>
                            ))}
                        </div>
                    </Card>
                </>
            )}
            {/* Модалка подтверждения войны */}
            {showWarModal && guild && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowWarModal(false)}>
                    <Card className="max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-3 text-center">⚔️ Объявить войну</h3>
                        <p className="text-sm mb-2">Противник: <span className="font-bold text-[var(--color-accent-danger)]">{guild.name}</span></p>
                        <div className="text-xs text-[var(--color-text-muted)] space-y-1.5 mb-4">
                            <p className="font-bold text-[var(--color-text-primary)]">Как проходит война:</p>
                            <p>• ⚔️ Война начинается <b>сразу</b> и длится <b>72 часа</b></p>
                            <p>• 🛡️ Каждый участник может быть атакован до <b>5 раз</b></p>
                            <p>• ⚔️ Каждый участник может атаковать до <b>3 раз</b></p>
                            <p>• 🏆 Побеждает гильдия с наибольшим счётом побед</p>
                            <p>• 💸 Проигравший передаёт всю казну победителю</p>
                            <p className="font-bold text-[var(--color-accent-warning)] mt-1">⚠️ Ограничения:</p>
                            <p>• 💰 Казна заморожена до конца войны</p>
                            <p>• 🚫 Нельзя покинуть гильдию</p>
                            <p>• 📛 Нельзя исключать участников</p>
                            <p>• 🚷 Нельзя принять новых участников</p>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <Button variant="secondary" size="md" onClick={() => setShowWarModal(false)}>Отмена</Button>
                            <Button variant="danger" size="md" onClick={async () => {
                                setShowWarModal(false);
                                try {
                                    const d = await api('/guild/war/declare', { targetGuildId: guild.id });
                                    setMessage(d.message);
                                    load();
                                } catch (e: any) { setMessage(e.message); }
                            }}>⚔️ Объявить войну</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
