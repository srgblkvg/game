import { useEffect, useState } from 'react';
import { useGlobalChat } from '../../contexts/ChatContext';
import Card from '../../components/ui/Card';
import { getHeaders } from '../../api/helpers';
import DataState from '../../components/ui/DataState';

type ActivityReport = {
    summary?: Record<string, string | number>;
    pages?: Array<Record<string, string | number>>;
    online?: Array<Record<string, string | number | null>>;
};

const numberValue = (value: unknown) => Number(value || 0);
const formatMinutes = (value: unknown) => `${(numberValue(value) / 60).toFixed(1)} мин`;

export default function AdminOnline() {
    const { onlineUsers } = useGlobalChat();
    const [report, setReport] = useState<ActivityReport | null>(null);
    const [days, setDays] = useState(1);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/admin/activity?days=${days}`, { headers: getHeaders() })
            .then(async response => {
                if (!response.ok) throw new Error('Не удалось загрузить аналитику');
                return response.json();
            })
            .then(data => { if (!cancelled) { setReport(data); setError(''); } })
            .catch(err => { if (!cancelled) setError(err.message); });
        return () => { cancelled = true; };
    }, [days]);

    const summary = report?.summary || {};
    const online = report?.online || [];
    const pages = report?.pages || [];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold">Игроки онлайн ({numberValue(summary.online_users) || onlineUsers.length})</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">Активное время считается только для видимой вкладки игры.</p>
                </div>
                <select value={days} onChange={e => setDays(Number(e.target.value))} className="bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded px-2 py-1 text-sm">
                    <option value={1}>За сутки</option>
                    <option value={7}>За 7 дней</option>
                    <option value={30}>За 30 дней</option>
                </select>
            </div>

            {error && <p className="text-sm text-[var(--color-accent-danger)]">{error}</p>}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="p-3"><div className="text-xs text-[var(--color-text-muted)]">Сейчас</div><b>{numberValue(summary.online_users)}</b></Card>
                <Card className="p-3"><div className="text-xs text-[var(--color-text-muted)]">Уникальных</div><b>{numberValue(summary.unique_users)}</b></Card>
                <Card className="p-3"><div className="text-xs text-[var(--color-text-muted)]">Сессий</div><b>{numberValue(summary.sessions)}</b></Card>
                <Card className="p-3"><div className="text-xs text-[var(--color-text-muted)]">Средняя сессия</div><b>{formatMinutes(summary.average_session_seconds)}</b></Card>
            </div>

            <Card className="p-3">
                <h3 className="font-bold mb-2">Активные игроки</h3>
                <DataState
                    isLoading={false}
                    isEmpty={online.length === 0}
                    empty={<p className="text-sm text-[var(--color-text-muted)]">Нет активных сессий</p>}
                >
                    <div className="space-y-1">
                        {online.map((u, index) => (
                            <div key={`${u.user_id}-${index}`} className="flex items-center gap-2 text-sm">
                                <span className="w-2 h-2 rounded-full bg-[var(--color-accent-success)]" />
                                <span className="font-medium">{String(u.username || `ID ${u.user_id}`)}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{String(u.path || '/')} · {formatMinutes(u.active_seconds)}</span>
                            </div>
                        ))}
                    </div>
                </DataState>
            </Card>

            <Card className="p-3">
                <h3 className="font-bold mb-2">Страницы игры</h3>
                <DataState
                    isLoading={false}
                    isEmpty={pages.length === 0}
                    empty={<p className="text-sm text-[var(--color-text-muted)]">Данные появятся после первых heartbeat.</p>}
                >
                    <div className="space-y-1">
                        {pages.map(page => (
                            <div key={String(page.path)} className="flex justify-between gap-3 text-sm">
                                <span>{String(page.path)}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{numberValue(page.unique_users)} игроков · {formatMinutes(page.active_seconds)}</span>
                            </div>
                        ))}
                    </div>
                </DataState>
            </Card>
        </div>
    );
}

// Сохраняем старый список онлайн через WS: он продолжает обновляться мгновенно,
// а отчёт добавляет долговременную статистику из БД.
void useGlobalChat;
