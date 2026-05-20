import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchBattles } from '../api';
import { fetchJobHistory } from '../api';
import { fetchAllPrivateMessagesNew } from '../api/chat';
import { formatMoney } from '../utils/money';

const LIMIT = 10; // элементов на странице

export default function HistoryPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'all' | 'battles' | 'jobs' | 'messages'>('all');
    const [battles, setBattles] = useState<any[]>([]);
    const [jobHistory, setJobHistory] = useState<any[]>([]);
    const [privateMessages, setPrivateMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Загрузка всех данных
    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [b, jh, pm] = await Promise.all([
                fetchBattles(100).catch(() => []),
                fetchJobHistory().catch(() => []),
                fetchAllPrivateMessagesNew()
                    .then((msgs: any[]) => msgs.filter((m: any) => m.targetId === user.id))
                    .catch(() => []),
            ]);
            setBattles(Array.isArray(b) ? b : []);
            setJobHistory(Array.isArray(jh) ? jh : []);
            setPrivateMessages(Array.isArray(pm) ? pm : []);
        } catch (e) {
            console.error(e);
            setBattles([]);
            setJobHistory([]);
            setPrivateMessages([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadData();
    }, [user, loadData, navigate]);

    // Формируем объединённый массив для вкладки «Все»
    const allEntries = [
        ...battles.map((b: any) => ({
            id: `battle-${b.id}`,
            type: 'battle' as const,
            timestamp: new Date(b.createdAt).getTime(),
            data: b,
        })),
        ...jobHistory.map((j: any) => ({
            id: `job-${j.id}`,
            type: 'job' as const,
            timestamp: new Date(j.finishedAt).getTime(),
            data: j,
        })),
        ...privateMessages.map((m: any) => ({
            id: `msg-${m.id}`,
            type: 'message' as const,
            timestamp: new Date(m.createdAt).getTime(),
            data: m,
        })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    // Определяем, какой массив отображать, в зависимости от вкладки
    const getCurrentData = (): any[] => {
        switch (tab) {
            case 'all': return allEntries;
            case 'battles': return battles;
            case 'jobs': return jobHistory;
            case 'messages': return privateMessages;
            default: return [];
        }
    };

    const currentData = getCurrentData();
    const totalItems = currentData.length;
    const totalPagesCalc = Math.ceil(totalItems / LIMIT);

    // При смене вкладки сбрасываем страницу и пересчитываем totalPages
    useEffect(() => {
        setPage(1);
    }, [tab]);

    useEffect(() => {
        setTotalPages(totalPagesCalc || 1);
    }, [totalPagesCalc]);

    // Пагинация: режем текущий массив
    const startIdx = (page - 1) * LIMIT;
    const paginatedData = currentData.slice(startIdx, startIdx + LIMIT);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    // Утилиты для type guard'ов
    const isBattle = (entry: any): entry is { type: 'battle'; data: any } => entry.type === 'battle';
    const isJob = (entry: any): entry is { type: 'job'; data: any } => entry.type === 'job';
    const isMessage = (entry: any): entry is { type: 'message'; data: any } => entry.type === 'message';

    if (!user) return null;

    return (
        <div style={{ padding: '1rem', color: '#eee' }}>
            <button
                onClick={() => navigate('/')}
                style={{
                    background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem',
                    borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem',
                }}
            >
                ← Назад
            </button>
            <h2>📜 Уведомления</h2>

            <div className="hide-scrollbar" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                {(['all', 'battles', 'jobs', 'messages'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: tab === t ? '#e63946' : '#555',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: tab === t ? 'bold' : 'normal',
                            whiteSpace: 'nowrap',         // запрещаем перенос текста
                        }}
                    >
                        {t === 'all' ? 'Все' : t === 'battles' ? 'Нападения' : t === 'jobs' ? 'Работы' : 'Сообщения'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div>Загрузка...</div>
            ) : (
                <div style={{ background: '#1e1e30', borderRadius: '8px', padding: '1rem' }}>
                    {/* Содержимое вкладки */}
                    {paginatedData.length === 0 ? (
                        <div>Нет записей</div>
                    ) : tab === 'all' ? (
                        paginatedData.map((entry) => (
                            <div key={entry.id} style={{ borderBottom: '1px solid #333', padding: '0.5rem 0', fontSize: '0.9rem' }}>
                                {isBattle(entry) && (
                                    <>
                                        <strong>
                                            {entry.data.attackerId === user.id ? 'Вы атаковали' : 'На вас напали'}
                                        </strong>{' '}
                                        игрока{' '}
                                        {entry.data.attackerId === user.id
                                            ? entry.data.defenderName
                                            : entry.data.attackerName}
                                        <span style={{ marginLeft: '1rem', color: entry.data.winnerId === user.id ? '#2ecc71' : '#e74c3c' }}>
                                            {entry.data.winnerId === user.id ? 'Победа' : 'Поражение'}
                                        </span>
                                        {entry.data.moneyStolen > 0 && (
                                            <span style={{ marginLeft: '0.5rem', color: '#f1c40f' }}>
                                                {entry.data.winnerId === user.id ? '+' : '-'}
                                                {formatMoney(entry.data.moneyStolen)}
                                            </span>
                                        )}
                                        <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                            {new Date(entry.data.createdAt).toLocaleString()}
                                        </div>
                                    </>
                                )}
                                {isJob(entry) && (
                                    <>
                                        <span>🛠️ «{entry.data.jobName}» завершена. Награда: {formatMoney(entry.data.reward)}</span>
                                        <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                            {new Date(entry.data.finishedAt).toLocaleString()}
                                        </div>
                                    </>
                                )}
                                {isMessage(entry) && (
                                    <>
                                        <span style={{ color: '#c084fc' }}>
                                            💬 {entry.data.senderName}: {entry.data.content}
                                        </span>
                                        <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                            {new Date(entry.data.createdAt).toLocaleString()}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    ) : tab === 'battles' ? (
                        paginatedData.map((b: any) => (
                            <div key={b.id} style={{ borderBottom: '1px solid #333', padding: '0.5rem 0', fontSize: '0.9rem' }}>
                                <strong>{b.attackerId === user.id ? 'Вы атаковали' : 'На вас напали'}</strong>{' '}
                                игрока {b.attackerId === user.id ? b.defenderName : b.attackerName}
                                <span style={{ marginLeft: '1rem', color: b.winnerId === user.id ? '#2ecc71' : '#e74c3c' }}>
                                    {b.winnerId === user.id ? 'Победа' : 'Поражение'}
                                </span>
                                {b.moneyStolen > 0 && (
                                    <span style={{ marginLeft: '0.5rem', color: '#f1c40f' }}>
                                        {b.winnerId === user.id ? '+' : '-'}
                                        {formatMoney(b.moneyStolen)}
                                    </span>
                                )}
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                    {new Date(b.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))
                    ) : tab === 'jobs' ? (
                        paginatedData.map((j: any) => (
                            <div key={j.id} style={{ borderBottom: '1px solid #333', padding: '0.5rem 0', fontSize: '0.9rem' }}>
                                <span>🛠️ «{j.jobName}» завершена. Награда: {formatMoney(j.reward)}</span>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                    {new Date(j.finishedAt).toLocaleString()}
                                </div>
                            </div>
                        ))
                    ) : (
                        paginatedData.map((m: any) => (
                            <div key={m.id} style={{ borderBottom: '1px solid #333', padding: '0.5rem 0', fontSize: '0.9rem' }}>
                                <span style={{ color: '#c084fc' }}>
                                    💬 {m.senderName}: {m.content}
                                </span>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                    {new Date(m.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Пагинация (только если больше одной страницы) */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                disabled={page <= 1}
                                onClick={() => handlePageChange(page - 1)}
                                style={{ background: '#555', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'not-allowed' }}
                            >
                                ← Назад
                            </button>
                            <span>стр. {page} из {totalPages}</span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => handlePageChange(page + 1)}
                                style={{ background: '#555', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'not-allowed' }}
                            >
                                Вперёд →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}