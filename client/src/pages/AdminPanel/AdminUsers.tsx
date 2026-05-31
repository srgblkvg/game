import { useState, useEffect } from 'react';
import { fetchAdminUsers, addMoneyToUser, adminFinishJob } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const inputClass = 'p-1.5 mr-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm w-24';

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [timerUserId, setTimerUserId] = useState('');
    const [moneyUserId, setMoneyUserId] = useState('');
    const [moneyAmount, setMoneyAmount] = useState('100');
    const [finishJobUserId, setFinishJobUserId] = useState('');
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
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Сброс таймеров</h3>
                <input type="number" placeholder="ID игрока" value={timerUserId} onChange={e => setTimerUserId(e.target.value)} className={inputClass} />
                <Button size="sm" onClick={() => resetTimers(false)} className="mr-2">Сбросить</Button>
                <Button variant="danger" size="sm" onClick={() => resetTimers(true)}>Сбросить всем</Button>
            </Card>

            <Card className="mb-4">
                <h3 className="font-bold mb-2">Пополнить баланс</h3>
                <input type="number" placeholder="ID игрока" value={moneyUserId} onChange={e => setMoneyUserId(e.target.value)} className={inputClass} />
                <input type="number" placeholder="Сумма" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} className={`${inputClass} w-20`} />
                <Button variant="success" size="sm" onClick={handleAddMoney}>Пополнить</Button>
            </Card>

            <Card className="mb-4">
                <h3 className="font-bold mb-2">Завершить работу по ID</h3>
                <input type="number" placeholder="ID игрока" value={finishJobUserId} onChange={e => setFinishJobUserId(e.target.value)} className={inputClass} />
                <Button size="sm" style={{ background: '#f39c12' }} onClick={() => handleFinishJob(parseInt(finishJobUserId))}>Завершить работу</Button>
            </Card>

            <Card>
                <h3 className="font-bold mb-2">Список игроков</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm min-w-[800px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1">ID</th><th className="text-left p-1">Имя</th><th className="text-left p-1">Ур.</th><th className="text-left p-1">Деньги</th><th className="text-left p-1">Боёв</th><th className="text-left p-1">Побед</th>
                                <th className="text-left p-1">Атака через</th><th className="text-left p-1">Защита до</th><th className="text-left p-1">Работа</th><th className="text-left p-1">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u: any) => {
                                const attackRemaining = u.lastAttackTime ? formatRemaining(u.lastAttackTime + 300) : '—';
                                const protectionRemaining = u.protectionUntil ? formatRemaining(u.protectionUntil) : '—';
                                const jobName = getActiveJobName(u);
                                return (
                                    <tr key={u.id} className="border-b border-[var(--color-border-light)]">
                                        <td className="p-1">{u.id}</td><td className="p-1">{u.username}</td><td className="p-1">{u.level}</td><td className="p-1">{u.money}</td><td className="p-1">{u.totalBattles}</td><td className="p-1">{u.wins}</td>
                                        <td className="p-1" style={{ color: attackRemaining === 'Готов' ? '#2ecc71' : '#f1c40f' }}>{attackRemaining}</td>
                                        <td className="p-1" style={{ color: protectionRemaining === 'Готов' ? '#2ecc71' : '#3498db' }}>{protectionRemaining}</td>
                                        <td className="p-1" style={{ color: jobName !== 'Нет' ? '#e67e22' : '#aaa' }}>{jobName}</td>
                                        <td className="p-1">
                                            {jobName !== 'Нет' && (
                                                <Button size="xs" style={{ background: '#f39c12' }} onClick={() => handleFinishJob(u.id)}>🏁 Завершить</Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {message && <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{message}</div>}
        </div>
    );
}
