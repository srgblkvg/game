import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api/character';
import { safeDate } from '../utils/date';
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
    const [inviteName, setInviteName] = useState('');
    const [inviteSuggestions, setInviteSuggestions] = useState<any[]>([]);
    const [inviteTargetId, setInviteTargetId] = useState<number | null>(null);

    // Казна
    const [treasuryAmount, setTreasuryAmount] = useState('');
    const [treasuryHistory, setTreasuryHistory] = useState<any[]>([]);
    const [treasuryBalance, setTreasuryBalance] = useState(guild?.treasury || 0);
    const [showTreasury, setShowTreasury] = useState(false);
    const [treasuryPage, setTreasuryPage] = useState(1);
    const [treasuryTotalPages, setTreasuryTotalPages] = useState(1);
    const [treasurySearch, setTreasurySearch] = useState('');
    const [taxRate, setTaxRate] = useState(guild?.taxRate || 0);
    const [taxRateInput, setTaxRateInput] = useState('');
    const [treasuryTab, setTreasuryTab] = useState<'deposit' | 'tax' | 'history'>('deposit');

    // Гильд-войны
    const [war, setWar] = useState<any>(null);
    const [warMessage, setWarMessage] = useState('');
    const [showWarRules, setShowWarRules] = useState(false);

    // Динамический поиск в истории казны
    useEffect(() => {
        if (treasuryTab !== 'history' || !showTreasury) return;
        const timer = setTimeout(() => loadTreasury(1, treasurySearch), 300);
        return () => clearTimeout(timer);
    }, [treasurySearch]);

    const searchUsers = async (q: string) => {
        if (q.length < 2) { setInviteSuggestions([]); return; }
        try {
            const r = await fetch(`${BASE_URL}/users/search?q=${encodeURIComponent(q)}`, { headers: getHeaders() });
            const data = await r.json();
            setInviteSuggestions(data || []);
        } catch { setInviteSuggestions([]); }
    };

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
                setTreasuryBalance(data.guild.treasury || 0);
                setTaxRate(data.guild.taxRate || 0);
                setWar(data.war || null);
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
        if (!inviteTargetId) { setError('Выберите игрока из списка'); return; }
        try {
            await api('/guild/invite', { targetId: inviteTargetId });
            setMessage('Приглашение отправлено!');
            setInviteName('');
            setInviteTargetId(null);
            setInviteSuggestions([]);
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

    const handleCancelInvites = async () => {
        try {
            const d = await api('/guild/cancel-invites', {});
            setMessage(`Отменено приглашений: ${d.cancelled}`);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const clearMessages = () => { setMessage(''); setError(''); setWarMessage(''); };

    // Гильд-войны: объявить войну
    const handleDeclareWar = async (targetGuildId: number, targetGuildName: string) => {
        if (!confirm(`Объявить войну гильдии «${targetGuildName}»?\nКазна обеих гильдий будет заморожена на 24 часа.`)) return;
        try {
            const d = await api('/guild/war/declare', { targetGuildId });
            setMessage(d.message);
            load();
        } catch (e: any) { setError(e.message); }
    };

    // Гильд-войны: ответить на войну
    const handleWarRespond = async (accept: boolean) => {
        try {
            const d = await api('/guild/war/respond', { accept });
            setMessage(d.message);
            load();
        } catch (e: any) { setError(e.message); }
    };

    const loadTreasury = async (pageNum = 1, search = '') => {
        try {
            const params = new URLSearchParams({ page: String(pageNum), limit: '10' });
            if (search) params.set('search', search);
            const r = await fetch(`${BASE_URL}/guild/treasury/history?${params}`, { headers: getHeaders() });
            const d = await r.json();
            if (r.ok) {
                setTreasuryBalance(d.treasury);
                setTreasuryHistory(d.history || []);
                setTreasuryPage(d.page);
                setTreasuryTotalPages(d.totalPages);
            }
        } catch {}
    };

    const handleDeposit = async () => {
        const amount = parseInt(treasuryAmount);
        if (!amount || amount < 1) { setError('Укажите сумму (минимум 1)'); return; }
        try {
            const r = await fetch(`${BASE_URL}/guild/treasury/deposit`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ amount }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setTreasuryBalance(d.treasury);
            setTreasuryAmount('');
            setMessage(`Внесено ${amount.toLocaleString()} серебра в казну`);
            loadTreasury(1, treasurySearch);
            const fresh = await fetchCharacter(); setCharacter(fresh);
        } catch (e: any) { setError(e.message); }
    };

    const handleSetTaxRate = async () => {
        const rate = parseInt(taxRateInput);
        if (isNaN(rate) || rate < 0 || rate > 50) { setError('Ставка от 0 до 50%'); return; }
        try {
            const r = await fetch(`${BASE_URL}/guild/tax-rate`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ taxRate: rate }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setTaxRate(rate);
            setTaxRateInput('');
            setMessage(`Ставка налога установлена: ${rate}%`);
        } catch (e: any) { setError(e.message); }
    };

    if (!user) return null;

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Гильдии</h1>

            {message && <p className="text-sm text-[var(--color-accent-success)] mb-3">{message}</p>}
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {guild ? (
                // --- Состою в гильдии ---
                <>
                    <Card className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h2 className="font-bold text-lg">🏚️ {guild.name}</h2>
                                <p className="text-xs text-[var(--color-text-muted)]">Уровень {guild.level} • {guild.memberCount} участников</p>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="secondary" size="xs" onClick={() => navigate('/guild/rating')}>Рейтинг гильдий</Button>
                                <Button variant="secondary" size="xs" onClick={handleLeave}>Покинуть</Button>
                            </div>
                        </div>
                        {guild.description && <p className="text-xs text-[var(--color-text-muted)] mb-2">{guild.description}</p>}
                        <p className="text-xs text-[var(--color-text-muted)]">
                            Тип: {guild.joinType === 'open' ? 'Открытая' : guild.joinType === 'request' ? 'По заявке' : 'По приглашению'}
                            {guild.myRank === 'leader' && ' • Вы лидер'}
                            {guild.myRank === 'officer' && ' • Вы офицер'}
                        </p>
                    </Card>

                    {/* Блок войны */}
                    {war && (
                        <Card className="mb-4 border-l-4 border-l-red-500">
                            <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
                                <Icon icon="game-icons:crossed-swords" width="18" height="18" style={{color: 'var(--color-war-active-text)'}} />
                                ⚔️ Поле битвы
                                <span className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold"
                                    style={{
                                        color: war.status === 'pending' ? 'var(--color-war-pending-text)' : 'var(--color-war-active-text)',
                                        backgroundColor: war.status === 'pending' ? 'var(--color-war-pending-bg)' : 'var(--color-war-active-bg)',
                                    }}
                                >
                                    {war.status === 'pending' ? 'Ожидает ответа' : 'Активна'}
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
                                    Объявлена: {safeDate(war.declaredAt) || new Date().toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                </p>
                                {war.acceptedAt && (
                                    <p className="text-[var(--color-text-muted)]">
                                        Принята: {safeDate(war.acceptedAt) || new Date().toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                    </p>
                                )}
                                <p className="text-[var(--color-text-muted)]">
                                    Окончание: {safeDate(war.expiresAt) || new Date().toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                </p>
                                {war.status === 'active' && (
                                    <p className="text-[0.65rem] mt-1" style={{color: 'var(--color-war-active-text)'}}>💰 Казна заморожена до конца войны</p>
                                )}
                            </div>
                            {war.status === 'active' && (
                                <Button variant="danger" size="xs" className="mt-3" onClick={() => navigate('/guild/war')}>
                                    ⚔️ На поле боя
                                </Button>
                            )}
                            {/* Кнопки для лидера защищающейся гильдии (только при pending) */}
                            {war.status === 'pending' && !war.isAttacker && guild.myRank === 'leader' && (
                                <div className="flex gap-2 mt-3">
                                    <Button variant="danger" size="xs" onClick={() => handleWarRespond(true)}>⚔️ Принять войну</Button>
                                    <Button variant="secondary" size="xs" onClick={() => handleWarRespond(false)}>Отклонить</Button>
                                </div>
                            )}
                            {war.status === 'pending' && war.isAttacker && (
                                <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-2">
                                    Ожидание ответа от лидера «{war.defenderGuild?.name || '???'}»
                                </p>
                            )}
                        </Card>
                    )}

                    {/* Описание войны */}
                    <Card className="mb-4">
                        <div
                            className="flex items-center gap-2 cursor-pointer select-none"
                            onClick={() => setShowWarRules(!showWarRules)}
                        >
                            <span className="text-sm">{showWarRules ? '▼' : '▶'}</span>
                            <h3 className="font-bold text-sm">⚔️ Война гильдий — правила</h3>
                        </div>
                        {showWarRules && (
                            <div className="text-xs text-[var(--color-text-muted)] space-y-1 mt-2">
                                <p>• Лидер может объявить войну другой гильдии (кнопка ⚔️ в списке гильдий или на странице гильдии).</p>
                                <p>• У защитника 24 часа на принятие. При отказе или бездействии война отменяется.</p>
                                <p>• После принятия — 24 часа боевых действий. Казна обеих гильдий замораживается.</p>
                                <p>• Каждый участник может атаковать врагов до 3 раз за войну, кулдаун между атаками — 5 минут.</p>
                                <p>• После атаки на игрока накладывается защита на 1 час от повторных атак.</p>
                                <p>• Победа в бою приносит +1 очко гильдии. Бой идёт на максимальном HP.</p>
                                <p>• Победитель по окончании войны забирает всю казну проигравшей гильдии.</p>
                            </div>
                        )}
                    </Card>

                    {/* Казна */}
                    <Card className="mb-4">
                        <div
                            className="flex items-center justify-between cursor-pointer select-none"
                            onClick={() => { if (!showTreasury) loadTreasury(1, treasurySearch); setShowTreasury(!showTreasury); }}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm">{showTreasury ? '▼' : '▶'}</span>
                                <h3 className="font-bold text-sm">💰 Казна</h3>
                                {taxRate > 0 && <span className="text-[0.6rem] text-[var(--color-text-muted)]">(налог {taxRate}%)</span>}
                            </div>
                            <span className="text-xs text-[var(--color-text-accent)]">
                                {treasuryBalance.toLocaleString()} серебра
                            </span>
                        </div>
                        {showTreasury && (
                            <div className="mt-3">
                                {/* Вкладки */}
                                <div className="flex border-b border-[var(--color-border-light)] mb-3">
                                    {(['deposit', 'tax', 'history'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => { setTreasuryTab(tab); if (tab === 'history') loadTreasury(1, treasurySearch); }}
                                            className={`px-3 py-1 text-xs cursor-pointer border-b-2 transition-colors ${
                                                treasuryTab === tab
                                                    ? 'border-[var(--color-accent-info)] text-[var(--color-accent-info)] font-bold'
                                                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                        >
                                            {tab === 'deposit' ? '💰 Вклад' : tab === 'tax' ? '📊 Налог' : '📋 История'}
                                        </button>
                                    ))}
                                </div>

                                {/* Вклад: Внесение */}
                                {treasuryTab === 'deposit' && (
                                    <div className="flex gap-2">
                                        <input
                                            type="number" min="1"
                                            placeholder="Сумма"
                                            value={treasuryAmount}
                                            onChange={e => setTreasuryAmount(e.target.value)}
                                            className={inputClass}
                                        />
                                        <Button variant="success" size="xs" onClick={handleDeposit}>Внести</Button>
                                    </div>
                                )}

                                {/* Вклад: Налог */}
                                {treasuryTab === 'tax' && (
                                    <div>
                                        {guild.myRank === 'leader' ? (
                                            <div className="p-2 bg-[var(--color-bg-input)] rounded">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-[var(--color-text-muted)]">Ставка:</span>
                                                    <span className="text-xs font-bold text-[var(--color-text-primary)]">{taxRate}%</span>
                                                    <input
                                                        type="number" min="0" max="50"
                                                        placeholder="0-50"
                                                        value={taxRateInput}
                                                        onChange={e => setTaxRateInput(e.target.value)}
                                                        className="w-16 text-xs px-1 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] text-[var(--color-text-primary)]"
                                                    />
                                                    <Button variant="primary" size="xs" onClick={handleSetTaxRate}>✓</Button>
                                                </div>
                                                <p className="text-[0.55rem] text-[var(--color-text-muted)] mt-1">% с дохода участников (PvE, PvP, работы, аукцион). Мин. 1 серебро.</p>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                Налог: <span className="font-bold text-[var(--color-text-primary)]">{taxRate}%</span> с дохода. Устанавливает лидер.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Вклад: История */}
                                {treasuryTab === 'history' && (
                                    <div>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                placeholder="Поиск по нику..."
                                                value={treasurySearch}
                                                onChange={e => setTreasurySearch(e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                        {treasuryHistory.length > 0 ? (
                                            <div className="text-xs">
                                                <div className="space-y-1">
                                                    {treasuryHistory.map((h: any) => (
                                                        <div key={h.id} className="flex justify-between py-0.5 border-b border-[var(--color-border-light)]">
                                                            <span className="text-[var(--color-text-primary)]">{h.username}</span>
                                                            <span className={h.type?.startsWith('tax') ? 'text-[var(--color-accent-warning)]' : 'text-[var(--color-text-accent)]'}>
                                                                +{h.amount.toLocaleString()}
                                                                {h.type?.startsWith('tax') && <span className="text-[0.55rem] ml-0.5">налог</span>}
                                                            </span>
                                                            <span className="text-[var(--color-text-muted)]">{safeDate(h.createdAt) || new Date().toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {treasuryTotalPages > 1 && (
                                                    <div className="flex justify-center gap-2 mt-2">
                                                        <Button size="xs" disabled={treasuryPage <= 1} onClick={() => loadTreasury(treasuryPage - 1, treasurySearch)}>←</Button>
                                                        <span className="text-[0.65rem] text-[var(--color-text-muted)]">{treasuryPage}/{treasuryTotalPages}</span>
                                                        <Button size="xs" disabled={treasuryPage >= treasuryTotalPages} onClick={() => loadTreasury(treasuryPage + 1, treasurySearch)}>→</Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-[var(--color-text-muted)]">Пока никто не вносил</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Пригласить (лидер/офицер) */}
                    {(guild.myRank === 'leader' || guild.myRank === 'officer') && (
                        <Card className="mb-4">
                            <h3 className="font-bold text-sm mb-2">Пригласить игрока</h3>
                            <div className="relative">
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Имя игрока" value={inviteName}
                                        onChange={e => { setInviteName(e.target.value); searchUsers(e.target.value); setInviteTargetId(null); }}
                                        className={inputClass} />
                                    <Button variant="primary" size="xs" onClick={handleInvite}>Пригласить</Button>
                                </div>
                                {inviteSuggestions.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                        {inviteSuggestions.map((u: any) => (
                                            <div key={u.id}
                                                onClick={() => { setInviteName(u.username); setInviteTargetId(u.id); setInviteSuggestions([]); }}
                                                className="px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer flex items-center gap-2">
                                                <span className="text-[var(--color-text-primary)]">{u.username}</span>
                                                <span className="text-[var(--color-text-muted)] ml-auto">ур.{u.level}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button variant="secondary" size="xs" onClick={handleCancelInvites} className="mt-2">Отменить все приглашения</Button>
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
                                <div key={m.userId} className="py-1 border-b border-[var(--color-border-light)]">
                                    <div className="flex items-center gap-2 text-xs">
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
                                        <span className="text-[var(--color-text-muted)]">ур.{m.level}</span>
                                        {(canManage || canKick) && (
                                            <div className="flex gap-1 ml-auto">
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
                                        )}
                                    </div>
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
                                    <h4 className="font-bold text-sm cursor-pointer hover:text-[var(--color-accent-info)] transition-colors"
                                        onClick={() => navigate(`/guild/${g.id}`)}>🏚️ {g.name}</h4>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Ур.{g.level} • {g.memberCount} уч. • {g.leaderName}
                                        {g.warStatus && <span className="ml-2" style={{color: 'var(--color-war-active-text)'}}>⚔️ В войне</span>}
                                    </p>
                                </div>
                                <div className="flex gap-1 items-center">
                                    {g.joinType !== 'invite' && (
                                        <Button variant="primary" size="xs"
                                            onClick={() => handleJoin(g.id, g.joinType)}>
                                            {g.joinType === 'open' ? 'Вступить' : 'Заявка'}
                                        </Button>
                                    )}
                                    {/* Кнопка объявления войны (только лидер, не себе, не в войне) */}
                                    {guild && guild.myRank === 'leader' && !g.warStatus && !war && (
                                        <Button variant="danger" size="xs" onClick={() => handleDeclareWar(g.id, g.name)}>
                                            ⚔️
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </>
            )}
        </div>
    );
}
