import { useState, useEffect } from 'react';
import { getHeaders, BASE_URL } from '../../api/helpers';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { fmtSafeDate } from '../../utils/date';

export default function AdminFeedback() {
    const [messages, setMessages] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => { load(); }, [page]);

    const load = async () => {
        try {
            const res = await fetch(`${BASE_URL}/admin/feedback?page=${page}&limit=20`, { headers: getHeaders() });
            const data = await res.json();
            if (data.messages) { setMessages(data.messages); setTotalPages(data.totalPages); }
        } catch {}
    };

    const markRead = async (id: number) => {
        await fetch(`${BASE_URL}/admin/feedback/read`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ id }),
        });
        load();
    };

    return (
        <div>
            <h2 className="text-lg font-bold mb-3">📬 Обращения</h2>
            {messages.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет обращений</p>
            ) : (
                <div className="space-y-2">
                    {messages.map((m: any) => (
                        <Card key={m.id} className={!m.read ? 'border-l-4 border-l-[var(--color-accent-info)]' : ''}>
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <span className="font-bold text-sm">{m.subject}</span>
                                    <span className="text-xs text-[var(--color-text-muted)] ml-2">
                                        от {m.username} • {fmtSafeDate(m.createdAt, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                    </span>
                                </div>
                                {!m.read && (
                                    <Button variant="secondary" size="xs" onClick={() => markRead(m.id)}>
                                        Прочитано
                                    </Button>
                                )}
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{m.message}</p>
                        </Card>
                    ))}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-3">
                            <Button size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</Button>
                            <span className="text-xs text-[var(--color-text-muted)]">{page}/{totalPages}</span>
                            <Button size="xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
