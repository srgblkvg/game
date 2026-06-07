import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';

export default function GuildPage() {
    const { user } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [guild, setGuild] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [guildList, setGuildList] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [createJoinType, setCreateJoinType] = useState<'open' | 'request' | 'invite'>('open');

    // Invite
    const [inviteTarget, setInviteTarget] = useState('');

    useEffect(() => { if (!user) navigate('/login'); else load(); }, [user]);

    const api = async (url: string, body?: any) => {
        const r = await fetch(`${BASE_URL}${url}`, { method: body ? 'POST' : 'GET', headers: getHeaders(), body: body ? JSON.stringify(body) : undefined });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
    };

    const load = async () => {
        try {
            const [data, list] = await Promise.all([
                fetch(`${BASE_URL}/guild/my`, { headers: getHeaders() }).then(r => r.json()),
                fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() }).then(r => r.json()),
            ]);
            if (data.guild) {
                setGuild(data.guild); setMembers(data.members);
                if (data.guild.myRank === 'leader' || data.guild.myRank === 'officer') {
                    fetch(`${BASE_URL}/guild/requests`, { headers: getHeaders() })
                        .then(r => r.json()).then(setRequests).catch(() => {});
                }
            }
            else { setGuild(null); setMembers([]); }
            setGuildList(list);
        } catch (e: any) { setError(e.message); }
    };

    const handleCreate = async () => {
        try {
            const d = await api('/guild/create', { name: createName, description: createDesc, joinType: createJoinType });
            setMessage(`Гильдия «${d.name}» создана!`);
            setShowCreate(false);
            const fresh = await fetchCharacter(); setCharacter(fresh);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleJoin = async (guildId: number, joinType: string) => {
        try {
            if (joinType === 'open') {
                await api(`/guild/join/${guildId}`, {});
                setMessage('Вы вступили в гильдию!');
            } else if (joinType === 'request') {
                await api(`/guild/request/${guildId}`, {});
                setMessage('Заявка отправлена!');
            }
            const fresh = await fetchCharacter(); setCharacter(fresh);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleInvite = async () => {
        try {
            await api('/guild/invite', { targetId: parseInt(inviteTarget) });
            setMessage('Приглашение отправлено!');
            setInviteTarget('');
        } catch (e: any) { setError(e.message); }
    };

    const handleLeave = async () => {
        if (!confirm('Покинуть гильдию?')) return;
        try {
            await api('/guild/leave', {});
            setGuild(null); setMembers([]);
            const fresh = await fetchCharacter(); setCharacter(fresh);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleRequest = async (requestId: number, accept: boolean) => {
        try {
            await api('/guild/handle-request', { requestId, accept });
            setMessage(accept ? 'Заявка принята!' : 'Заявка отклонена');
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleKick = async (targetId: number, username: string) => {
        if (!confirm(`Исключить ${username} из гильдии?`)) return;
        try {
            await api('/guild/kick', { targetId });
            setMessage(`${username} исключён`);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const handleRole = async (targetId: number, username: string, rank: string) => {
        try {
            await api('/guild/role', { targetId, rank });
            setMessage(`${username} → ${rank === 'officer' ? 'офицер' : 'боец'}`);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const clearMessages = () => { setMessage(''); setError(''); };

    if (!user) return null;

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Гильдии</h1>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            {guild ? (
                // --- Состою в гильдии ---
                <>
                    <Card className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h2 className="font-bold text-lg">🏚️ {guild.name}</h2>
                                <p className="text-xs text-[var(--color-text-muted)]">Уровень {guild.level} • {guild.memberCount} участников</p>
                            </div>
                            <Button variant="secondary" size="xs" onClick={handleLeave}>Покинуть</Button>
                        </div>
                        {guild.description && <p className="text-xs text-[var(--color-text-muted)] mb-2">{guild.description}</p>}
                        <p className="text-xs text-[var(--color-text-muted)]">
                            Тип: {guild.joinType === 'open' ? 'Открытая' : guild.joinType === 'request' ? 'По заявке' : 'По приглашению'}
                            {guild.myRank === 'leader' && ' • Вы лидер'}
                            {guild.myRank === 'officer' && ' • Вы офицер'}
                        </p>
                    </Card>

                    {/* Пригласить (лидер/офицер) */}
                    {(guild.myRank === 'leader' || guild.myRank === 'officer') && (
                        <Card className="mb-4">
                            <h3 className="font-bold text-sm mb-2">Пригласить игрока</h3>
                            <div className="flex gap-2">
                                <input type="number" placeholder="ID игрока" value={inviteTarget}
                                    onChange={e => setInviteTarget(e.target.value)} className={inputClass} />
                                <Button variant="primary" size="xs" onClick={handleInvite}>Пригласить</Button>
                            </div>
                        </Card>
                    )}

                    {/* Заявки (лидер/офицер) */}
                    {(guild.myRank === 'leader' || guild.myRank === 'officer') && requests.length > 0 && (
                        <Card className="mb-4">
                            <h3 className="font-bold text-sm mb-2">Заявки на вступление ({requests.length})</h3>
                            <div className="space-y-2">
                                {requests.map((r: any) => (
                                    <div key={r.id} className="flex items-center gap-2 text-xs">
                                        <span className="text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                            onClick={() => navigate(`/profile/${r.userId}`)}>
                                            {r.username}
                                        </span>
                                        <div className="flex gap-1 ml-auto">
                                            <Button variant="success" size="xs" onClick={() => handleRequest(r.id, true)}>Принять</Button>
                                            <Button variant="danger" size="xs" onClick={() => handleRequest(r.id, false)}>Отклонить</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Участники */}
                    <Card>
                        <h3 className="font-bold text-sm mb-2">Участники ({members.length})</h3>
                        <div className="space-y-1">
                            {members.map((m: any) => {
                                const canKick = (guild.myRank === 'leader' || guild.myRank === 'officer')
                                    && m.userId !== user.id
                                    && m.rank !== 'leader'
                                    && !(guild.myRank === 'officer' && m.rank === 'officer');
                                const canManage = guild.myRank === 'leader' && m.userId !== user.id && m.rank !== 'leader';
                                return (
                                <div key={m.userId} className="flex items-center gap-2 text-xs py-1 border-b border-[var(--color-border-light)]">
                                    <span className="w-6 text-center">
                                        {m.rank === 'leader' ? '👑' : m.rank === 'officer' ? '🛡️' : '⚔️'}
                                    </span>
                                    <span className="text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                        onClick={() => navigate(`/profile/${m.userId}`)}>
                                        {m.username}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] text-[0.6rem] ml-1">
                                        {m.rank === 'leader' ? 'лидер' : m.rank === 'officer' ? 'офицер' : 'боец'}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] ml-auto">ур.{m.level}</span>
                                    {canManage && (
                                        <Button variant="secondary" size="xs"
                                            onClick={() => handleRole(m.userId, m.username, m.rank === 'officer' ? 'member' : 'officer')}>
                                            {m.rank === 'officer' ? 'Разжаловать' : 'Офицер'}
                                        </Button>
                                    )}
                                    {canKick && (
                                        <Button variant="danger" size="xs" onClick={() => handleKick(m.userId, m.username)}>Исключить</Button>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </Card>
                </>
            ) : (
                // --- Не в гильдии ---
                <>
                    <div className="flex gap-2 mb-4">
                        <Button variant={showCreate ? 'secondary' : 'primary'} size="sm"
                            onClick={() => { setShowCreate(!showCreate); clearMessages(); }}>
                            {showCreate ? 'Отмена' : 'Создать гильдию'}
                        </Button>
                    </div>

                    {showCreate && (
                        <Card className="mb-4">
                            <h3 className="font-bold mb-2">Создание гильдии</h3>
                            <input placeholder="Название" value={createName}
                                onChange={e => setCreateName(e.target.value)} className={inputClass + ' mb-2'} />
                            <input placeholder="Описание (необязательно)" value={createDesc}
                                onChange={e => setCreateDesc(e.target.value)} className={inputClass + ' mb-2'} />
                            <select value={createJoinType}
                                onChange={e => setCreateJoinType(e.target.value as any)} className={inputClass}>
                                <option value="open">Открытая (любой может вступить)</option>
                                <option value="request">По заявке (требуется одобрение)</option>
                                <option value="invite">По приглашению (только приглашённые)</option>
                            </select>
                            <p className="text-xs text-[var(--color-text-muted)] mb-2">Создание: 0 серебра</p>
                            <Button variant="danger" size="sm" onClick={handleCreate}
                                disabled={!createName.trim()}>Создать</Button>
                        </Card>
                    )}

                    {/* Список гильдий */}
                    <h3 className="font-bold text-sm mb-2">Существующие гильдии</h3>
                    {guildList.length === 0 && (
                        <p className="text-xs text-[var(--color-text-muted)]">Нет гильдий</p>
                    )}
                    {guildList.map((g: any) => (
                        <Card key={g.id} className="mb-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-sm">🏚️ {g.name}</h4>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Ур.{g.level} • {g.memberCount} уч. • {g.leaderName}
                                    </p>
                                </div>
                                <Button variant="primary" size="xs"
                                    onClick={() => handleJoin(g.id, g.joinType)}>
                                    {g.joinType === 'open' ? 'Вступить' : g.joinType === 'request' ? 'Заявка' : 'Закрыто'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </>
            )}
        </div>
    );
}
