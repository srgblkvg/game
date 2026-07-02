import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { fmtSafeDate } from '../utils/date';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';
import { useAuth } from '../contexts/AuthContext';

const MAX_QUOTE_LENGTH = 300;

function stripQuotes(text: string): string {
    return text.split('\n').filter(line => !line.startsWith('>')).join('\n').trim();
}

function renderContent(content: string): string {
    const lines = content.split('\n');
    const parts: { type: 'quote' | 'text'; text: string }[] = [];
    let current: { type: 'quote' | 'text'; text: string } = { type: 'text', text: '' };
    for (const line of lines) {
        const isQuote = line.startsWith('>');
        if (isQuote !== (current.type === 'quote')) {
            if (current.text) parts.push(current);
            current = { type: isQuote ? 'quote' : 'text', text: '' };
        }
        current.text += (current.text ? '\n' : '') + (isQuote ? line.replace(/^>\s?/, '') : line);
    }
    if (current.text) parts.push(current);
    return parts.map(p =>
        p.type === 'quote'
            ? `<blockquote class="border-l-2 border-[var(--color-accent-info)] pl-3 my-2 text-sm text-[var(--color-text-muted)]">${p.text}</blockquote>`
            : `<span>${p.text}</span>`
    ).join('\n');
}

function PostCard({ post, children, onReply, depth = 0, isFirst = false, userId }: any) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const isLong = post.content.length > 500;
    const displayContent = editing ? editText : (isLong && !expanded ? post.content.slice(0, 500) + '...' : post.content);
    const dateStr = fmtSafeDate(post.updated_at || post.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isEdited = !!post.updated_at;
    const canEdit = userId && post.author_id === userId;

    const handleSaveEdit = async () => {
        if (!editText.trim()) return;
        try {
            const res = await fetch(`/api/forum/post/${post.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ content: editText }),
            });
            if (res.ok) {
                post.content = editText;
                post.updated_at = new Date().toISOString();
                setEditing(false);
            }
        } catch { }
    };

    return (
        <div className={depth > 0 ? 'ml-4 sm:ml-6 border-l-2 border-[var(--color-border-light)] pl-3' : ''}>
            <Card className={`mb-2 ${isFirst ? 'border border-[#f59e0b]/30 relative mt-3' : ''}`}>
                {isFirst && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-bg-secondary)] border border-[#f59e0b]/30 rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-[0_0_6px_rgba(245,158,11,0.3)]">
                        📢
                    </div>
                )}
                <div className="flex items-start gap-3 mt-1">
                    <img src={post.author_avatar || '/character_man.webp'} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-[var(--color-bg-input)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <a href={`/profile/${post.author_id}`} className="text-xs font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] no-underline" onClick={e => e.stopPropagation()}>{post.author_name}</a>
                            {post.author_guild && (
                                <a href={`/guild/${post.author_guild}`} className="text-[0.6rem] text-[var(--color-accent-success)] hover:underline no-underline" onClick={e => e.stopPropagation()}>[{post.author_guild_name}]</a>
                            )}
                            <span className="text-[0.6rem] text-[var(--color-text-muted)]">{dateStr}</span>
                            {isEdited && <span className="text-[0.55rem] text-[var(--color-text-muted)]">(ред.)</span>}
                            <span className="text-[0.6rem] text-[var(--color-text-muted)]">#{post.id}</span>
                            {isFirst && <span className="text-[0.55rem] text-[var(--color-accent-warning)] font-bold">Автор</span>}
                        </div>
                        <div className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: editing ? '<span></span>' : renderContent(displayContent) }} />
                        {editing && (
                            <div className="mt-2">
                                <textarea className={inputClass + ' min-h-[100px] mb-2'} value={editText}
                                    onChange={e => setEditText(e.target.value)} />
                                <div className="flex gap-2">
                                    <Button variant="success" size="xs" onClick={handleSaveEdit}>Сохранить</Button>
                                    <Button variant="secondary" size="xs" onClick={() => setEditing(false)}>Отмена</Button>
                                </div>
                            </div>
                        )}
                        {isLong && !editing && (
                            <button className="text-xs text-[var(--color-accent-info)] mt-1 cursor-pointer hover:underline" onClick={() => setExpanded(!expanded)}>{expanded ? 'Свернуть' : 'Читать дальше'}</button>
                        )}
                        <button className="text-xs text-[var(--color-text-muted)] mt-1.5 cursor-pointer hover:text-[var(--color-accent-info)]"
                            onClick={() => {
                                const cleaned = stripQuotes(post.content.slice(0, MAX_QUOTE_LENGTH));
                                onReply(`> ${post.author_name}:\n> ${cleaned}\n\n`, post.id);
                            }}>Ответить</button>
                        {canEdit && !editing && (
                            <button className="text-xs text-[var(--color-text-muted)] mt-1.5 ml-2 cursor-pointer hover:text-[var(--color-accent-info)]"
                                onClick={() => { setEditText(post.content); setEditing(true); }}>✎</button>
                        )}
                    </div>
                </div>
            </Card>
            {children && children.length > 0 && (
                <div>
                    {children.map((child: any) => (
                        <PostCard key={child.id} post={child} children={child.children} onReply={onReply} depth={depth + 1} userId={userId} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ThreadPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [thread, setThread] = useState<any>(null);
    const [firstPost, setFirstPost] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPageState] = useState(() => {
        const p = searchParams.get('page');
        if (!p || p === 'last') return 0;
        return parseInt(p) || 1;
    });
    const [replyText, setReplyText] = useState('');
    const [replyParentId, setReplyParentId] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const replyRef = useRef<HTMLTextAreaElement>(null);

    const isAuthor = user && thread && user.id === thread.author_id;

    const load = async (pg = page) => {
        try {
            if (pg === 0) {
                const res = await fetch(`/api/forum/thread/${id}?page=1`, { headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setThread(data.thread);
                setFirstPost(data.firstPost || null);
                const lastPg = data.totalPages || 1;
                setTotalPages(lastPg);
                if (lastPg <= 1) {
                    setPosts(data.posts || []);
                    setPageState(1);
                    setSearchParams({ page: '1' }, { replace: true });
                } else {
                    const res2 = await fetch(`/api/forum/thread/${id}?page=${lastPg}`, { headers: getHeaders() });
                    const data2 = await res2.json();
                    if (res2.ok) {
                        setPosts(data2.posts || []);
                        setPageState(data2.page || lastPg);
                    }
                    setSearchParams({ page: String(lastPg) }, { replace: true });
                }
                return;
            }

            const res = await fetch(`/api/forum/thread/${id}?page=${pg}`, { headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setThread(data.thread);
            setFirstPost(data.firstPost || null);
            setPosts(data.posts || []);
            setTotalPages(data.totalPages || 1);
            setPageState(data.page || 1);
        } catch (e: any) { setError(e.message); }
    };

    useEffect(() => { if (id) load(); }, [id]);

    const goToPage = (pg: number) => {
        setPageState(pg);
        setSearchParams({ page: String(pg) }, { replace: true });
        load(pg);
    };

    const handleReply = async () => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            const res = await fetch('/api/forum/reply', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ threadId: parseInt(id!), content: replyText, parentId: replyParentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setReplyText('');
            setReplyParentId(null);
            goToPage(0);
        } catch (e: any) { setError(e.message); }
        finally { setSending(false); }
    };

    const handleReplyClick = (text: string, parentId: number) => {
        setReplyText(text);
        setReplyParentId(parentId);
        replyRef.current?.scrollIntoView({ behavior: 'smooth' });
        replyRef.current?.focus();
    };

    const handleToggleClose = async () => {
        try {
            const res = await fetch(`/api/forum/thread/${id}/close`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ closed: !thread.is_closed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setThread({ ...thread, is_closed: data.is_closed });
        } catch (e: any) { setError(e.message); }
    };

    const handleEditTitle = async () => {
        if (!newTitle.trim()) return;
        try {
            const res = await fetch(`/api/forum/thread/${id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ title: newTitle }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setThread({ ...thread, title: newTitle });
            setEditingTitle(false);
        } catch (e: any) { setError(e.message); }
    };

    const buildTree = (flatPosts: any[]) => {
        const map = new Map<number, any>();
        const roots: any[] = [];
        for (const p of flatPosts) { p.children = []; map.set(p.id, p); }
        for (const p of flatPosts) {
            if (p.parent_id && map.has(p.parent_id)) map.get(p.parent_id).children.push(p);
            else roots.push(p);
        }
        return roots;
    };

    if (error && !thread) return <div className="p-4 text-[var(--color-accent-danger)]">{error}</div>;
    if (!thread) return <div className="p-4">Загрузка...</div>;

    const tree = buildTree(posts);

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            {editingTitle ? (
                <div className="mb-4">
                    <input className={inputClass + ' mb-2'} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Новое название" />
                    <div className="flex gap-2">
                        <Button variant="success" size="xs" onClick={handleEditTitle}>Сохранить</Button>
                        <Button variant="secondary" size="xs" onClick={() => setEditingTitle(false)}>Отмена</Button>
                    </div>
                </div>
            ) : (
                <h1 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
                    <Icon icon="game-icons:discussion" width="22" height="22" className="inline" />
                    {thread.title}
                    {thread.is_closed && <span className="text-xs text-[var(--color-accent-danger)] border border-[var(--color-accent-danger)] rounded px-1.5 py-0.5">Закрыто</span>}
                    {isAuthor && (
                        <div className="flex gap-1 ml-auto">
                            <Button variant="secondary" size="xs" onClick={() => { setNewTitle(thread.title); setEditingTitle(true); }}>✎</Button>
                            <Button variant="secondary" size="xs" onClick={handleToggleClose}>
                                {thread.is_closed ? 'Открыть' : 'Закрыть'}
                            </Button>
                        </div>
                    )}
                </h1>
            )}
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {firstPost && <PostCard post={firstPost} onReply={handleReplyClick} isFirst={true} userId={user?.id} />}
            {tree.map(p => <PostCard key={p.id} post={p} children={p.children} onReply={handleReplyClick} userId={user?.id} />)}

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mb-4">
                    <Button variant="secondary" size="xs" disabled={page <= 1} onClick={() => goToPage(page - 1)}>←</Button>
                    <span className="text-sm text-[var(--color-text-muted)]">{page}/{totalPages}</span>
                    <Button variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>→</Button>
                </div>
            )}

            {thread.is_closed ? (
                <Card className="mt-4 p-3 text-center text-sm text-[var(--color-text-muted)]">
                    🔒 Тема закрыта автором. Новые сообщения не принимаются.
                </Card>
            ) : (
                <Card className="mt-4">
                    {replyParentId && (
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">
                            Ответ на #{replyParentId}
                            <button className="ml-2 text-[var(--color-accent-danger)]" onClick={() => { setReplyParentId(null); setReplyText(''); }}>отмена</button>
                        </p>
                    )}
                    <textarea ref={replyRef} id="reply-input" className={inputClass + ' min-h-[100px] mb-2'} placeholder="Ваш ответ..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                    <Button variant="primary" size="sm" onClick={handleReply} disabled={sending || !replyText.trim()}>{sending ? 'Отправка...' : 'Ответить'}</Button>
                </Card>
            )}
        </div>
    );
}
