import { useState, useEffect, useCallback } from 'react';
import { fetchAdminUsers, addMoneyToUser, adminFinishJob, banUser, unbanUser, deleteUser, fetchUserIps, grantPremium } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { inputClass } from "../../utils/formStyles";
import { fmtSafeDate } from "../../utils/date";

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));

    // Таймеры/деньги/работы
    const [timerUserId, setTimerUserId] = useState('');
    const [moneyUserId, setMoneyUserId] = useState('');
    const [moneyAmount, setMoneyAmount] = useState('100');
    const [finishJobUserId, setFinishJobUserId] = useState('');

    // Бан
    const [banUserId, setBanUserId] = useState<number | null>(null);
    const [banDuration, setBanDuration] = useState('1');
    const [banUnit, setBanUnit] = useState<'minutes' | 'hours' | 'days'>('hours');

    // Раскрытая строка (детали игрока)
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
    const [expandedView, setExpandedView] = useState<'info' | 'ips' | null>(null);
    const [userIps, setUserIps] = useState<any[]>([]);
    const [ipsLoading, setIpsLoading] = useState(false);

    // Подтверждение удаления
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Премиум
    const [premiumUserId, setPremiumUserId] = useState('');
    const [premiumDays, setPremiumDays] = useState('7');

    // Поиск по имени
    const [searchQuery, setSearchQuery] = useState('');
    // Фильтр: все / игроки / гости
    const [userFilter, setUserFilter] = useState<string>('all');

    useEffect(() => {
        const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 5000);
        return () => clearInterval(interval);
    }, []);

    const loadUsers = useCallback(async () => {
        try { setUsers(await fetchAdminUsers(userFilter)); } catch (e) { console.error(e); }
    }, [userFilter]);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    const resetTimers = async (all = false) => {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/admin/reset-timers', {
                method: 'POST', headers,
                body: JSON.stringify(all ? { all: true } : { userId: parseInt(timerUserId) }),
            });
            const data = await res.json();
            setMessage(res.ok ? (all ? 'Таймеры сброшены всем' : 'Таймеры сброшены') : data.error);
            loadUsers();
        } catch (e) { setMessage('Ошибка сети'); }
    };

    const handleAddMoney = async () => {
        try {
            await addMoneyToUser(parseInt(moneyUserId), parseInt(moneyAmount));
            setMessage(`Баланс игрока ${moneyUserId} пополнен на ${moneyAmount}`);
            loadUsers();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleFinishJob = async (userId: number) => {
        try {
            const res = await adminFinishJob(userId);
            setMessage(res.message);
            loadUsers();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleGrantPremium = async () => {
        try {
            const res = await grantPremium(parseInt(premiumUserId), parseInt(premiumDays));
            setMessage(res.message);
            loadUsers();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleBan = async (userId: number) => {
        try {
            const res = await banUser(userId, parseInt(banDuration), banUnit);
            setMessage(res.message);
            setBanUserId(null);
            loadUsers();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUnban = async (userId: number) => {
        try {
            const res = await unbanUser(userId);
            setMessage(res.message);
            loadUsers();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDelete = async (userId: number) => {
        try {
            const res = await deleteUser(userId);
            setMessage(res.message);
            setDeleteConfirmId(null);
            loadUsers();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleShowIps = async (userId: number) => {
        if (expandedUserId === userId && expandedView === 'ips') {
            setExpandedUserId(null);
            setExpandedView(null);
            return;
        }
        setExpandedUserId(userId);
        setExpandedView('ips');
        setIpsLoading(true);
        try {
            const ips = await fetchUserIps(userId);
            setUserIps(ips);
        } catch { setUserIps([]); }
        setIpsLoading(false);
    };

    const toggleInfo = (userId: number) => {
        if (expandedUserId === userId && expandedView === 'info') {
            setExpandedUserId(null);
            setExpandedView(null);
        } else {
            setExpandedUserId(userId);
            setExpandedView('info');
        }
    };

    const formatRemaining = (timestamp: number) => {
        if (!timestamp) return '—';
        const diff = timestamp - now;
        if (diff <= 0) return 'Готов';
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        return `${h ? h + 'ч ' : ''}${m}м ${s}с`;
    };

    const formatBanRemaining = (bannedUntil: number) => {
        if (!bannedUntil) return null;
        const diff = bannedUntil - now;
        if (diff <= 0) return null;
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const parts = [];
        if (d > 0) parts.push(`${d}д`);
        if (h > 0) parts.push(`${h}ч`);
        if (m > 0) parts.push(`${m}м`);
        return parts.join(' ');
    };

    const getActiveJobName = (user: any) => {
        if (!user.activeJob) return 'Нет';
        try {
            const job = typeof user.activeJob === 'string' ? JSON.parse(user.activeJob) : user.activeJob;
            return job.name || 'Да';
        } catch { return 'Да'; }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const formatLastLogin = (value: any) => {
        if (!value) return '—';
        // Unix timestamp (число) — новые записи
        if (typeof value === 'number') {
            const diffSec = Math.floor(Date.now() / 1000) - value;
            if (diffSec < 60) return 'сейчас';
            if (diffSec < 3600) return `${Math.floor(diffSec / 60)}м`;
            if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}ч`;
            if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}д`;
            return fmtSafeDate(value, { day:'2-digit', month:'2-digit' });
        }
        // Строка даты — старые записи (парсим как UTC чтобы избежать сдвига)
        const d = new Date(String(value).replace(' ', 'T') + 'Z');
        if (isNaN(d.getTime())) return String(value);
        const diffMs = Date.now() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'сейчас';
        if (diffMin < 60) return `${diffMin}м`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours}ч`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}д`;
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    };

    const filteredUsers = searchQuery
        ? users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
        : users;

    const oauthLabel = (provider: string | null) => {
        if (!provider) return 'Email';
        if (provider === 'yandex') return 'Яндекс';
        if (provider === 'vkontakte') return 'VK';
        return provider;
    };

    return (
        <div>
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Сброс таймеров</h3>
                <input type="number" placeholder="ID игрока" value={timerUserId} onChange={e => setTimerUserId(e.target.value)} className={inputClass} />
                <Button size="md" onClick={() => resetTimers(false)} className="mr-2">Сбросить</Button>
                <Button variant="danger" size="md" onClick={() => resetTimers(true)}>Сбросить всем</Button>
            </Card>

            <Card className="mb-4">
                <h3 className="font-bold mb-2">Пополнить баланс</h3>
                <input type="number" placeholder="ID игрока" value={moneyUserId} onChange={e => setMoneyUserId(e.target.value)} className={inputClass} />
                <input type="number" placeholder="Сумма" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} className={`${inputClass} w-20`} />
                <Button variant="success" size="md" onClick={handleAddMoney}>Пополнить</Button>
            </Card>

            <Card className="mb-4">
                <h3 className="font-bold mb-2">Выдать премиум</h3>
                <input type="number" placeholder="ID игрока" value={premiumUserId} onChange={e => setPremiumUserId(e.target.value)} className={inputClass} />
                <input type="number" placeholder="Дней" value={premiumDays} onChange={e => setPremiumDays(e.target.value)} className={`${inputClass} w-20`} min="1" />
                <Button variant="success" size="md" onClick={handleGrantPremium}>Выдать</Button>
            </Card>

            <Card className="mb-4">
                <h3 className="font-bold mb-2">Завершить работу по ID</h3>
                <input type="number" placeholder="ID игрока" value={finishJobUserId} onChange={e => setFinishJobUserId(e.target.value)} className={inputClass} />
                <Button size="md" style={{ background: '#f39c12' }} onClick={() => handleFinishJob(parseInt(finishJobUserId))}>Завершить работу</Button>
            </Card>

            {message && <div className="mb-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{message}</div>}

            <Card>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">Список игроков ({filteredUsers.length}{searchQuery ? ` / ${users.length}` : ''})</h3>
                    <div className="flex gap-1">
                        <Button size="md" variant={userFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setUserFilter('all')}>Все</Button>
                        <Button size="md" variant={userFilter === 'players' ? 'primary' : 'secondary'} onClick={() => setUserFilter('players')}>Игроки</Button>
                        <Button size="md" variant={userFilter === 'guests' ? 'primary' : 'secondary'} onClick={() => setUserFilter('guests')}>🎭 Гости</Button>
                    </div>
                    <input
                        type="text"
                        placeholder="Поиск по имени..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className={`${inputClass} w-48`}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm min-w-[1300px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1">ID</th>
                                <th className="text-left p-1">Имя</th>
                                <th className="text-left p-1">Ур.</th>
                                <th className="text-left p-1">Деньги</th>
                                <th className="text-left p-1">Боёв</th>
                                <th className="text-left p-1">Побед</th>
                                <th className="text-left p-1">Email/Пров.</th>
                                <th className="text-left p-1">OAuth</th>
                                <th className="text-left p-1">Рег.</th>
                                <th className="text-left p-1">Посл. вход</th>
                                <th className="text-left p-1">Бан</th>
                                <th className="text-left p-1">Премиум</th>
                                <th className="text-left p-1">Атака</th>
                                <th className="text-left p-1">Работа</th>
                                <th className="text-left p-1">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u: any) => {
                                const attackRemaining = u.lastAttackTime ? formatRemaining(u.lastAttackTime + 300) : '—';
                                const jobName = getActiveJobName(u);
                                const banRemaining = formatBanRemaining(u.bannedUntil);
                                const isExpanded = expandedUserId === u.id;

                                return (
                                    <tr key={u.id} className={`border-b border-[var(--color-border-light)] ${u.bannedUntil > now ? 'bg-red-900/20' : ''}`}>
                                        <td className="p-1">{u.id}</td>
                                        <td className="p-1">{u.username}{u.isGuest ? <span className="ml-1 text-[var(--color-accent-warning)] text-xs">🎭</span> : ''}</td>
                                        <td className="p-1">{u.level}</td>
                                        <td className="p-1">{u.money}</td>
                                        <td className="p-1">{u.totalBattles}</td>
                                        <td className="p-1">{u.wins}</td>
                                        <td className="p-1" style={{ fontSize: '11px' }}>
                                            <div>{u.email || '—'}</div>
                                            <div style={{ color: u.emailVerified ? '#2ecc71' : '#e74c3c' }}>
                                                {u.email ? (u.emailVerified ? '✓ подтв.' : '✗ не подтв.') : ''}
                                            </div>
                                        </td>
                                        <td className="p-1" style={{ fontSize: '11px' }}>{oauthLabel(u.oauthProvider)}</td>
                                        <td className="p-1" style={{ fontSize: '11px' }}>{formatDate(u.createdAt)}</td>
                                        <td className="p-1" style={{ fontSize: '11px', color: u.lastLoginAt ? '#2ecc71' : '#888' }}>
                                            {formatLastLogin(u.lastLoginAt)}
                                        </td>
                                        <td className="p-1" style={{ color: banRemaining ? '#e74c3c' : '#2ecc71' }}>
                                            {banRemaining || 'Нет'}
                                        </td>
                                        <td className="p-1" style={{ color: (u.premiumUntil || 0) > now ? '#f1c40f' : '#888' }}>
                                            {(u.premiumUntil || 0) > now ? formatRemaining(u.premiumUntil) : 'Нет'}
                                        </td>
                                        <td className="p-1" style={{ color: attackRemaining === 'Готов' ? '#2ecc71' : '#f1c40f' }}>{attackRemaining}</td>
                                        <td className="p-1" style={{ color: jobName !== 'Нет' ? '#e67e22' : '#aaa' }}>{jobName}</td>
                                        <td className="p-1">
                                            <div className="flex gap-1 flex-wrap">
                                                <Button size="md" variant="secondary" onClick={() => toggleInfo(u.id)}>
                                                    {isExpanded && expandedView === 'info' ? '▲' : '▼'}
                                                </Button>
                                                <Button size="md" variant="secondary" onClick={() => handleShowIps(u.id)}>
                                                    IP
                                                </Button>
                                                {jobName !== 'Нет' && (
                                                    <Button size="md" style={{ background: '#f39c12' }} onClick={() => handleFinishJob(u.id)}>🏁</Button>
                                                )}
                                                {u.bannedUntil > now ? (
                                                    <Button size="md" variant="success" onClick={() => handleUnban(u.id)}>Разбан</Button>
                                                ) : (
                                                    <Button size="md" variant="danger" onClick={() => setBanUserId(u.id)}>Бан</Button>
                                                )}
                                                {deleteConfirmId === u.id ? (
                                                    <span className="flex gap-1">
                                                        <Button size="md" variant="danger" onClick={() => handleDelete(u.id)}>Точно?</Button>
                                                        <Button size="md" variant="secondary" onClick={() => setDeleteConfirmId(null)}>✕</Button>
                                                    </span>
                                                ) : (
                                                    <Button size="md" variant="secondary" style={{ color: '#e03030', borderColor: '#e03030' }}
                                                        onClick={() => setDeleteConfirmId(u.id)}>✕</Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Детали раскрытой строки */}
                {expandedUserId != null && expandedView === 'info' && (() => {
                    const user = users.find(u => u.id === expandedUserId);
                    if (!user) return null;
                    return (
                        <div className="mt-2 p-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-sm">
                            <h4 className="font-bold mb-1">#{user.id} {user.username}{user.isGuest ? <span className="ml-1 text-[var(--color-accent-warning)]">🎭 Гость</span> : ''}</h4>
                            <div className="grid grid-cols-2 gap-1" style={{ fontSize: '12px' }}>
                                <div>Email: {user.email || '—'}</div>
                                <div>Подтверждён: {user.emailVerified ? 'Да' : 'Нет'}</div>
                                <div>OAuth: {user.oauthProvider || 'Нет'}</div>
                                <div>Регистрация: {user.createdAt || '—'}</div>
                                <div>Посл. вход: {user.lastLoginAt || '—'}</div>
                                <div>Бан до: {user.bannedUntil ? fmtSafeDate(user.bannedUntil) : 'Нет'}</div>
                            </div>
                        </div>
                    );
                })()}

                {expandedUserId != null && expandedView === 'ips' && (
                    <div className="mt-2 p-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-sm">
                        <h4 className="font-bold mb-1">IP-адреса игрока #{expandedUserId}</h4>
                        {ipsLoading ? (
                            <p className="text-[var(--color-text-muted)]">Загрузка...</p>
                        ) : userIps.length === 0 ? (
                            <p className="text-[var(--color-text-muted)]">Нет данных</p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--color-border-light)]">
                                        <th className="text-left p-1">IP</th>
                                        <th className="text-left p-1">Последний вход</th>
                                        <th className="text-left p-1">Входов</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userIps.map((ip: any, i: number) => (
                                        <tr key={i} className="border-b border-[var(--color-border-light)]">
                                            <td className="p-1 font-mono">{ip.ip}</td>
                                            <td className="p-1">{ip.lastSeen}</td>
                                            <td className="p-1">{ip.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Форма бана (вне таблицы, под карточкой) */}
                {banUserId != null && (
                    <div className="mt-2 p-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded">
                        <h4 className="font-bold text-sm mb-2">Бан игрока #{banUserId}</h4>
                        <div className="flex gap-2 items-center">
                            <input type="number" min="1" value={banDuration}
                                onChange={e => setBanDuration(e.target.value)} className={`${inputClass} w-20`} />
                            <select value={banUnit} onChange={e => setBanUnit(e.target.value as any)}
                                className={`${inputClass} w-24`}>
                                <option value="minutes">Минуты</option>
                                <option value="hours">Часы</option>
                                <option value="days">Дни</option>
                            </select>
                            <Button variant="danger" size="md" onClick={() => handleBan(banUserId)}>Забанить</Button>
                            <Button variant="secondary" size="md" onClick={() => setBanUserId(null)}>Отмена</Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
