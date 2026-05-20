import { useState, useEffect } from 'react';
import { fetchAdminUsers, addMoneyToUser, adminFinishJob } from '../../api';

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [message, setMessage] = useState('');

    // таймеры
    const [timerUserId, setTimerUserId] = useState('');
    // пополнение
    const [moneyUserId, setMoneyUserId] = useState('');
    const [moneyAmount, setMoneyAmount] = useState('100');
    // завершение работы
    const [finishJobUserId, setFinishJobUserId] = useState('');
    // текущее время для отображения таймеров
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));

    useEffect(() => {
        const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 5000);
        return () => clearInterval(interval);
    }, []);

    const loadUsers = async () => {
        try { setUsers(await fetchAdminUsers()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadUsers(); }, []);

    const resetTimers = async (all = false) => {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('http://localhost:3001/api/admin/reset-timers', {
                method: 'POST',
                headers,
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

    const formatRemaining = (timestamp: number) => {
        if (!timestamp) return '—';
        const diff = timestamp - now;
        if (diff <= 0) return 'Готов';
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        return `${h ? h + 'ч ' : ''}${m}м ${s}с`;
    };

    const getActiveJobName = (user: any) => {
        if (!user.activeJob) return 'Нет';
        try {
            const job = typeof user.activeJob === 'string' ? JSON.parse(user.activeJob) : user.activeJob;
            return job.name || 'Да';
        } catch { return 'Да'; }
    };

    return (
        <div>
            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Сброс таймеров</h3>
                <input type="number" placeholder="ID игрока" value={timerUserId} onChange={e => setTimerUserId(e.target.value)} style={{ padding: '0.3rem', marginRight: '0.5rem' }} />
                <button onClick={() => resetTimers(false)} style={{ marginRight: '0.5rem' }}>Сбросить</button>
                <button onClick={() => resetTimers(true)} style={{ background: '#c0392b', color: '#fff' }}>Сбросить всем</button>
            </div>

            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Пополнить баланс</h3>
                <input type="number" placeholder="ID игрока" value={moneyUserId} onChange={e => setMoneyUserId(e.target.value)} style={{ padding: '0.3rem', marginRight: '0.5rem', width: '120px' }} />
                <input type="number" placeholder="Сумма" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} style={{ padding: '0.3rem', marginRight: '0.5rem', width: '100px' }} />
                <button onClick={handleAddMoney} style={{ background: '#2ecc71', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', color: '#fff' }}>Пополнить</button>
            </div>

            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Завершить работу по ID</h3>
                <input type="number" placeholder="ID игрока" value={finishJobUserId} onChange={e => setFinishJobUserId(e.target.value)} style={{ padding: '0.3rem', marginRight: '0.5rem', width: '120px' }} />
                <button onClick={() => handleFinishJob(parseInt(finishJobUserId))} style={{ background: '#f39c12', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', color: '#fff' }}>Завершить работу</button>
            </div>

            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Список игроков</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #444' }}>
                                <th>ID</th><th>Имя</th><th>Ур.</th><th>Деньги</th><th>Боёв</th><th>Побед</th>
                                <th>Атака через</th><th>Защита до</th><th>Работа</th><th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u: any) => {
                                const attackRemaining = u.lastAttackTime ? formatRemaining(u.lastAttackTime + 300) : '—';
                                const protectionRemaining = u.protectionUntil ? formatRemaining(u.protectionUntil) : '—';
                                const jobName = getActiveJobName(u);
                                return (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #333' }}>
                                        <td>{u.id}</td><td>{u.username}</td><td>{u.level}</td><td>{u.money}</td><td>{u.totalBattles}</td><td>{u.wins}</td>
                                        <td style={{ color: attackRemaining === 'Готов' ? '#2ecc71' : '#f1c40f' }}>{attackRemaining}</td>
                                        <td style={{ color: protectionRemaining === 'Готов' ? '#2ecc71' : '#3498db' }}>{protectionRemaining}</td>
                                        <td style={{ color: jobName !== 'Нет' ? '#e67e22' : '#aaa' }}>{jobName}</td>
                                        <td>
                                            {jobName !== 'Нет' && (
                                                <button onClick={() => handleFinishJob(u.id)} style={{ background: '#f39c12', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>🏁 Завершить</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {message && <div style={{ marginTop: '1rem', background: '#2a2a3e', padding: '0.5rem', borderRadius: '4px' }}>{message}</div>}
        </div>
    );
}