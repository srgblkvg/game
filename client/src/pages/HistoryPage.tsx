import { Icon } from "@iconify/react";
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchBattles } from '../api';
import { fetchJobHistory } from '../api';
import { fetchAllPrivateMessagesNew } from '../api/chat';
import { formatMoney } from '../utils/money';
import { renderBattleLog } from '../utils/battleLog';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';

const LIMIT = 10;

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
    const [selectedBattle, setSelectedBattle] = useState<any>(null);

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
            setBattles([]); setJobHistory([]); setPrivateMessages([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadData();
    }, [user, loadData, navigate]);

    const allEntries = [
        ...battles.map((b: any) => ({
            id: `battle-${b.id}`, type: 'battle' as const,
            timestamp: new Date(b.createdAt).getTime(), data: b,
        })),
        ...jobHistory.map((j: any) => ({
            id: `job-${j.id}`, type: 'job' as const,
            timestamp: new Date(j.finishedAt).getTime(), data: j,
        })),
        ...privateMessages.map((m: any) => ({
            id: `msg-${m.id}`, type: 'message' as const,
            timestamp: new Date(m.createdAt).getTime(), data: m,
        })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    const currentData = (() => {
        switch (tab) {
            case 'all': return allEntries;
            case 'battles': return battles;
            case 'jobs': return jobHistory;
            case 'messages': return privateMessages;
            default: return [];
        }
    })();

    const totalItems = currentData.length;
    const totalPagesCalc = Math.ceil(totalItems / LIMIT);

    useEffect(() => { setPage(1); }, [tab]);
    useEffect(() => { setTotalPages(totalPagesCalc || 1); }, [totalPagesCalc]);

    const startIdx = (page - 1) * LIMIT;
    const paginatedData = currentData.slice(startIdx, startIdx + LIMIT);

    const isBattle = (e: any): e is { type: 'battle'; data: any } => e.type === 'battle';
    const isJob = (e: any): e is { type: 'job'; data: any } => e.type === 'job';
    const isMessage = (e: any): e is { type: 'message'; data: any } => e.type === 'message';

    const tabs = [
        { key: 'all', label: 'Все' } as const,
        { key: 'battles', label: 'Нападения' } as const,
        { key: 'jobs', label: 'Работы' } as const,
        { key: 'messages', label: 'Сообщения' } as const,
    ];

    if (!user) return null;

    const renderBattleEntry = (b: any) => (
        <div
            className="border-b border-[var(--color-border-light)] py-2 text-sm cursor-pointer hover:bg-[var(--color-bg-card-hover)] px-1 rounded"
            onClick={() => setSelectedBattle(b)}
        >
            <div className="flex items-center gap-2">
                <strong>{b.attackerId === user.id ? (<><Icon icon="game-icons:crossed-swords" width="16" height="16" className="inline mr-1" />Вы атаковали</>) : (<><Icon icon="game-icons:shield" width="16" height="16" className="inline mr-1" />На вас напали</>)}</strong>
                <span>игрока {b.attackerId === user.id ? b.defenderName : b.attackerName}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
                <span className={`font-bold ${b.winnerId === user.id ? 'text-[var(--color-accent-success)]' : 'text-red-500'}`}>
                    {b.winnerId === user.id ? 'Победа' : 'Поражение'}
                </span>
                {b.moneyStolen > 0 && (
                    <span className="text-[var(--color-text-accent)] text-xs">
                        {b.winnerId === user.id ? '+' : '-'}{formatMoney(b.moneyStolen)}
                    </span>
                )}
                {b.expGained > 0 && (
                    <span className="text-[var(--color-accent-purple)] text-xs">+{b.expGained} опыта</span>
                )}
                <span className="text-[var(--color-text-muted)] text-xs ml-auto">
                    {new Date(b.createdAt).toLocaleString()}
                </span>
            </div>
        </div>
    );

    const renderBattleModal = () => {
        if (!selectedBattle) return null;
        let steps: any[] = [];
        try {
            steps = typeof selectedBattle.steps === 'string'
                ? JSON.parse(selectedBattle.steps)
                : (selectedBattle.steps || []);
        } catch { steps = []; }

        return (
            <Modal
                open={!!selectedBattle}
                onClose={() => setSelectedBattle(null)}
                title={`⚔ ${selectedBattle.attackerName} vs ${selectedBattle.defenderName}`}
                width="min(900px, calc(100vw - 2rem))"
                borderColor="var(--color-border-default)"
            >
                <div className="bg-black rounded-lg p-3 max-h-[60vh] overflow-y-auto font-mono text-xs leading-relaxed">
                    {renderBattleLog(steps)}
                </div>
                <div className="flex gap-4 justify-between mt-3 text-sm">
                    <span className={selectedBattle.winnerId === user.id ? 'text-[var(--color-accent-success)] font-bold' : 'text-red-500 font-bold'}>
                        {selectedBattle.winnerId === user.id ? (<><Icon icon="game-icons:trophy" width="16" height="16" className="inline mr-1" />Победа</>) : (<><Icon icon="game-icons:death-skull" width="16" height="16" className="inline mr-1" />Поражение</>)}
                    </span>
                    <span>Опыт: +{selectedBattle.expGained || 0}</span>
                    {selectedBattle.moneyStolen > 0 && (
                        <span className="text-[var(--color-text-accent)]">
                            {selectedBattle.winnerId === user.id ? '+' : '-'}{formatMoney(selectedBattle.moneyStolen)}
                        </span>
                    )}
                </div>
                <div className="flex justify-center mt-4">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedBattle(null)}>Закрыть</Button>
                </div>
            </Modal>
        );
    };

    return (
        <div className="px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:ringing-bell" width="22" height="22" className="inline mr-2"/>Уведомления</h2>

            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
                {tabs.map((t) => (
                    <Button
                        key={t.key}
                        variant={tab === t.key ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => setTab(t.key)}
                        className="whitespace-nowrap"
                    >
                        {t.label}
                    </Button>
                ))}
            </div>

            {loading ? (
                <p className="text-[var(--color-text-muted)]">Загрузка...</p>
            ) : (
                <Card>
                    {paginatedData.length === 0 ? (
                        <p className="text-[var(--color-text-muted)]">Нет записей</p>
                    ) : tab === 'all' ? (
                        paginatedData.map((entry) => (
                            <div key={entry.id}>
                                {isBattle(entry) && renderBattleEntry(entry.data)}
                                {isJob(entry) && (
                                    <div className="border-b border-[var(--color-border-light)] py-2 text-sm">
                                        <span><Icon icon="game-icons:swap-bag" width="14" height="14" className="inline mr-1"/>«{entry.data.jobName}» завершена. Награда: {formatMoney(entry.data.reward)}</span>
                                        <div className="text-xs text-[var(--color-text-muted)]">{new Date(entry.data.finishedAt).toLocaleString()}</div>
                                    </div>
                                )}
                                {isMessage(entry) && (
                                    <div className="border-b border-[var(--color-border-light)] py-2 text-sm">
                                        <span className="text-purple-400"><Icon icon="game-icons:chat-bubble" width="14" height="14" className="inline mr-1"/>{entry.data.senderName}: {entry.data.content}</span>
                                        <div className="text-xs text-[var(--color-text-muted)]">{new Date(entry.data.createdAt).toLocaleString()}</div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : tab === 'battles' ? (
                        paginatedData.map((b: any) => (
                            <div key={b.id}>{renderBattleEntry(b)}</div>
                        ))
                    ) : tab === 'jobs' ? (
                        paginatedData.map((j: any) => (
                            <div key={j.id} className="border-b border-[var(--color-border-light)] py-2 text-sm">
                                <span><Icon icon="game-icons:swap-bag" width="14" height="14" className="inline mr-1"/>«{j.jobName}» завершена. Награда: {formatMoney(j.reward)}</span>
                                <div className="text-xs text-[var(--color-text-muted)]">{new Date(j.finishedAt).toLocaleString()}</div>
                            </div>
                        ))
                    ) : (
                        paginatedData.map((m: any) => (
                            <div key={m.id} className="border-b border-[var(--color-border-light)] py-2 text-sm">
                                <span className="text-purple-400"><Icon icon="game-icons:chat-bubble" width="14" height="14" className="inline mr-1"/>{m.senderName}: {m.content}</span>
                                <div className="text-xs text-[var(--color-text-muted)]">{new Date(m.createdAt).toLocaleString()}</div>
                            </div>
                        ))
                    )}

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-4 mt-4 items-center">
                            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</Button>
                            <span className="text-sm text-[var(--color-text-secondary)]">стр. {page} из {totalPages}</span>
                            <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Вперёд →</Button>
                        </div>
                    )}
                </Card>
            )}

            {renderBattleModal()}
        </div>
    );
}
