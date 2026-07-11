import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { fmtSafeDate } from '../utils/date';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import MdToolbar from '../components/ui/MdToolbar';

export default function ForumPage() {
    const isVKMobile = typeof document !== 'undefined'
        && document.documentElement.classList.contains('vk-iframe')
        && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const navigate = useNavigate();
    const [threads, setThreads] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [mode, setMode] = useState<'list' | 'new'>('list');
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    // Опрос
    const [hasPoll, setHasPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

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

    const resetForm = () => {
        setNewTitle('');
        setNewContent('');
        setHasPoll(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        setMode('list');
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) { setError('Заполните название и текст'); return; }
        if (hasPoll) {
            if (!pollQuestion.trim()) { setError('Введите вопрос опроса'); return; }
            const valid = pollOptions.filter(o => o.trim());
            if (valid.length < 2) { setError('Нужно минимум 2 варианта ответа'); return; }
        }
        setCreating(true);
        try {
            const body: any = { title: newTitle, content: newContent };
            if (hasPoll) {
                body.poll = {
                    question: pollQuestion,
                    options: pollOptions.filter(o => o.trim()),
                };
            }
            const res = await fetch('/api/forum/thread', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            resetForm();
            navigate(`/forum/${data.id}`);
        } catch (e: any) { setError(e.message); }
        finally { setCreating(false); }
    };

    const addOption = () => {
        if (pollOptions.length < 10) setPollOptions([...pollOptions, '']);
    };
    const removeOption = (i: number) => {
        if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, idx) => idx !== i));
    };
    const updateOption = (i: number, val: string) => {
        const next = [...pollOptions];
        next[i] = val;
        setPollOptions(next);
    };

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            {mode === 'list' && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold"><Icon icon="game-icons:discussion" width="22" height="22" className="inline mr-2" />Форум</h1>
                        <Button variant="primary" size="md" onClick={() => setMode('new')}>Новая тема</Button>
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
                            <Button variant="secondary" size="md" disabled={page <= 1} onClick={() => load(page - 1)}>←</Button>
                            <span className="text-sm text-[var(--color-text-muted)] self-center">{page}/{totalPages}</span>
                            <Button variant="secondary" size="md" disabled={page >= totalPages} onClick={() => load(page + 1)}>→</Button>
                        </div>
                    )}
                </>
            )}

            {mode === 'new' && (
                <div>
                    <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:discussion" width="22" height="22" className="inline mr-2" />Новая тема</h1>

                    {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

                    <input className={inputClass + ' mb-2'} placeholder="Название темы" value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={200} />
                    {!isVKMobile && <MdToolbar textareaId="forum-new-content" />}
                    <textarea id="forum-new-content" className={inputClass + ' mb-3 min-h-[200px]'} placeholder="Текст сообщения" value={newContent} onChange={e => setNewContent(e.target.value)} />

                    {/* Опрос */}
                    {!isVKMobile && (<div className="mb-3 border-t border-[var(--color-border-light)] pt-3">
                        <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer" onClick={() => setHasPoll(!hasPoll)}>
                            <input type="checkbox" checked={hasPoll} onChange={e => setHasPoll(e.target.checked)} className="cursor-pointer" />
                            <Icon icon="game-icons:checked-shield" width="16" height="16" />
                            Добавить голосование
                        </label>
                        {hasPoll && (
                            <div className="space-y-2 pl-2 border-l-2 border-[var(--color-accent-info)]">
                                <input className={inputClass} placeholder="Вопрос голосования" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} maxLength={200} />
                                {pollOptions.map((opt, i) => (
                                    <div key={i} className="flex gap-1">
                                        <input className={inputClass + ' flex-1'} placeholder={`Вариант ${i + 1}`} value={opt}
                                            onChange={e => updateOption(i, e.target.value)} maxLength={100} />
                                        {pollOptions.length > 2 && (
                                            <Button variant="secondary" size="md" onClick={() => removeOption(i)}>✕</Button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 10 && (
                                    <Button variant="secondary" size="md" onClick={addOption}>+ Добавить вариант</Button>
                                )}
                            </div>
                        )}
                    </div>)}

                    <div className="flex gap-2">
                        <Button variant="primary" size="md" disabled={creating} onClick={handleCreate}>
                            {creating ? 'Создание...' : 'Создать тему'}
                        </Button>
                        <Button variant="secondary" size="md" onClick={resetForm}>Отмена</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
