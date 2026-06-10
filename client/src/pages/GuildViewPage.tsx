import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function GuildViewPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [guild, setGuild] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [myGuild, setMyGuild] = useState<any>(null);
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, [id]);

    const load = async () => {
        try {
            const r = await fetch(`${BASE_URL}/guild/${id}`, { headers: getHeaders() });
            const data = await r.json();
            if (!r.ok) { setMessage(data.error || 'Ошибка'); return; }
            setGuild(data.guild);
            setMembers(data.members);
        } catch { setMessage('Ошибка загрузки'); }

        // Проверяем свою гильдию
        try {
            const r = await fetch(`${BASE_URL}/guild/my`, { headers: getHeaders() });
            const data = await r.json();
            if (data.guild) setMyGuild(data.guild);
        } catch {}
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

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}

            {guild && (
                <>
                    <Button variant="secondary" size="sm" onClick={() => navigate('/guild/rating')} className="mb-3">
                        ← Рейтинг гильдий
                    </Button>
                    <Card className="mb-4">
                        <h1 className="font-bold text-lg flex items-center gap-2">
                            🏚️ {guild.name}
                            <span className="text-xs text-[var(--color-text-muted)] font-normal">ур.{guild.level}</span>
                        </h1>
                        {guild.description && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">{guild.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                            <span>👑 {guild.leaderName}</span>
                            <span>👥 {guild.memberCount} уч.</span>
                            <span>
                                {guild.joinType === 'open' ? '🔓 Открытая' : guild.joinType === 'request' ? '📝 По заявке' : '🔒 По приглашению'}
                            </span>
                        </div>
                        {!isMember && (
                            <div className="mt-3">
                                <Button variant="primary" size="sm" onClick={handleJoin}>
                                    {guild.joinType === 'open' ? 'Вступить' : guild.joinType === 'request' ? 'Подать заявку' : 'Закрыто'}
                                </Button>
                            </div>
                        )}
                        {isMember && (
                            <div className="mt-3">
                                <Button variant="secondary" size="sm" onClick={() => navigate('/guild')}>Управление гильдией</Button>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <h3 className="font-bold text-sm mb-2">Участники ({members.length})</h3>
                        <div className="space-y-1">
                            {members.map((m: any) => (
                                <div key={m.userId} className="flex items-center gap-2 text-xs py-1 border-b border-[var(--color-border-light)]">
                                    <span className="w-6 text-center">
                                        {m.rank === 'leader' ? '👑' : m.rank === 'officer' ? '🛡️' : '⚔️'}
                                    </span>
                                    <span className="text-[var(--color-accent-info)] cursor-pointer hover:underline"
                                        onClick={() => navigate(`/profile/${m.userId}`)}>
                                        {m.username}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] text-[0.6rem]">
                                        {m.rank === 'leader' ? 'лидер' : m.rank === 'officer' ? 'офицер' : 'боец'}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] ml-auto">ур.{m.level}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}
