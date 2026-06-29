import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { fmtSafeDate } from '../utils/date';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import Modal from '../components/ui/Modal';

export default function ForumPage() {
    const navigate = useNavigate();
    const [threads, setThreads] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showNew, setShowNew] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const load = async (pg = 1) => {
        try {
            const res = await fetch(`/api/forum/threads?page=${pg}&limit=10`, { headers: getHeaders() });
            const data = await res.json();
            setThreads(data.threads || []);
            setTotalPages(data.totalPages || 1);
            setPage(data.page || 1);
        } catch { }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) { setError('Заполните название и текст'); return; }
        setCreating(true);
        try {
            const res = await fetch('/api/forum/thread', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ title: newTitle, content: newContent }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setShowNew(false);
            setNewTitle('');
            setNewContent('');
            navigate(`/forum/${data.id}`);
        } catch (e: any) { setError(e.message); }
        finally { setCreating(false); }
    };

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold"><Icon icon="game-icons:discussion" width="22" height="22" className="inline mr-2" />Форум</h1>
                <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>Новая тема</Button>
            </div>

            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {threads.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Тем пока нет</p>
            ) : (
                <div className="space-y-2">
                    {threads.map(t => (
                        <Card key={t.id} className="cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                            onClick={() => navigate(`/forum/${t.id}?page=last`)}>
                            <h3 className="font-bold text-sm mb-1">{t.title}</h3>
                            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                                <span>Автор: {t.author_name} • {fmtSafeDate(t.created_at)}</span>
                                <span>{t.posts_count} сообщ.</span>
                            </div>
                            {t.last_poster_name && (
                                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                                    Последнее: {t.last_poster_name} • {fmtSafeDate(t.updated_at)}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button variant="secondary" size="xs" disabled={page <= 1} onClick={() => load(page - 1)}>←</Button>
                    <span className="text-sm text-[var(--color-text-muted)] self-center">{page}/{totalPages}</span>
                    <Button variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => load(page + 1)}>→</Button>
                </div>
            )}

            <Modal open={showNew} onClose={() => setShowNew(false)} title="Новая тема">
                <input className={inputClass + ' mb-2'} placeholder="Название темы" value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={200} />
                <textarea className={inputClass + ' mb-3 min-h-[120px]'} placeholder="Текст сообщения" value={newContent} onChange={e => setNewContent(e.target.value)} />
                <Button variant="primary" size="sm" fullWidth disabled={creating} onClick={handleCreate}>
                    {creating ? 'Создание...' : 'Создать тему'}
                </Button>
            </Modal>
        </div>
    );
}
