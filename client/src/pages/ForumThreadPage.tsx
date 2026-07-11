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
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import MdToolbar from '../components/ui/MdToolbar';

// Настройка marked
marked.setOptions({
    breaks: true,     // перенос строки → <br>
    gfm: true,        // GitHub Flavored Markdown (таблицы, списки задач и т.д.)
});

function renderMd(content: string): string {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'span'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target'],
    });
}

const FORUM_STYLES = `
.forum-content blockquote {
    border-left: 2px solid var(--color-accent-info);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
}
.forum-content h1 { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.25rem; }
.forum-content h2 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
.forum-content h3 { font-size: 1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
.forum-content ul, .forum-content ol { padding-left: 1.5rem; margin: 0.25rem 0; }
.forum-content code { background: var(--color-bg-input); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
.forum-content pre { background: var(--color-bg-input); padding: 0.5rem; border-radius: 4px; overflow-x: auto; margin: 0.5rem 0; }
.forum-content pre code { background: none; padding: 0; }
.forum-content a { color: var(--color-accent-info); text-decoration: underline; }
.forum-content table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
.forum-content th, .forum-content td { border: 1px solid var(--color-border-light); padding: 0.25rem 0.5rem; font-size: 0.875rem; }
.forum-content th { background: var(--color-bg-input); }
.forum-content hr { border: none; border-top: 1px solid var(--color-border-light); margin: 0.75rem 0; }
.forum-content img { max-width: 100%; border-radius: 4px; }
`;

function PostCard({ post, children, onReply, depth = 0, isFirst = false, userId, replyTargetId, isClosed }: any) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const isLong = post.content.length > 500;
    const displayContent = editing ? editText : (isLong && !expanded ? post.content.slice(0, 500) + '...' : post.content);
    const dateStr = fmtSafeDate(post.updated_at || post.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isEdited = !!post.updated_at;
    const canEdit = userId && post.author_id === userId && !isClosed;
    const isReplyTarget = replyTargetId && post.id === replyTargetId;

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
            <Card className={`mb-2 ${isFirst ? 'border-l-4 border-l-[var(--color-accent-info)] bg-[var(--color-bg-card)]' : ''} ${isReplyTarget && !isFirst ? 'border-l-4 border-l-[var(--color-accent-warning)]' : ''}`}>
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
                        </div>
                        <div className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words forum-content" dangerouslySetInnerHTML={{ __html: editing ? '<span></span>' : renderMd(displayContent) }} />
                        {editing && (
                            <div className="mt-2">
                                <MdToolbar textareaId={`forum-edit-${post.id}`} />
                                <textarea id={`forum-edit-${post.id}`} className={inputClass + ' min-h-[100px] mb-2'} value={editText}
                                    onChange={e => setEditText(e.target.value)} />
                                <div className="flex gap-2">
                                    <Button variant="success" size="md" onClick={handleSaveEdit}>Сохранить</Button>
                                    <Button variant="secondary" size="md" onClick={() => setEditing(false)}>Отмена</Button>
                                </div>
                            </div>
                        )}
                        {isLong && !editing && (
                            <button className="text-xs text-[var(--color-accent-info)] mt-1 cursor-pointer hover:underline" onClick={() => setExpanded(!expanded)}>{expanded ? 'Свернуть' : 'Читать дальше'}</button>
                        )}
                        {!isClosed && (
                            <div className="flex gap-2 mt-1.5 items-center">
                                <button className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-accent-info)]"
                                    onClick={() => {
                                        const lines = post.content.split('\n');
                                        const quoted = lines.map(l => l.startsWith('>') ? l : `> ${l}`).join('\n');
                                        onReply(`> ${post.author_name}:\n${quoted}\n\n`, post.id);
                                    }}>Ответить</button>
                                {canEdit && !editing && (
                                    <Button variant="secondary" size="md" onClick={() => { setEditText(post.content); setEditing(true); }}>✎</Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
            {children && children.length > 0 && (
                <div>
                    {children.map((child: any) => (
                        <PostCard key={child.id} post={child} children={child.children} onReply={onReply} depth={depth + 1} userId={userId} replyTargetId={replyTargetId} isClosed={isClosed} />
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
    const [poll, setPoll] = useState<any>(null);
    const [pollVoting, setPollVoting] = useState(false);
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
                setPoll(data.poll || null);
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
            if (data.poll) setPoll(data.poll);
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

    const handleVote = async (optionId: number) => {
        setPollVoting(true);
        try {
            const res = await fetch('/api/forum/poll/vote', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ threadId: parseInt(id!), optionId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPoll((prev: any) => ({ ...prev, options: data.options }));
        } catch (e: any) { setError(e.message); }
        finally { setPollVoting(false); }
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
            <style>{FORUM_STYLES}</style>
            <BackButton />
            {editingTitle ? (
                <div className="mb-4">
                    <input className={inputClass + ' mb-2'} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Новое название" />
                    <div className="flex gap-2">
                        <Button variant="success" size="md" onClick={handleEditTitle}>Сохранить</Button>
                        <Button variant="secondary" size="md" onClick={() => setEditingTitle(false)}>Отмена</Button>
                    </div>
                </div>
            ) : (
                <h1 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
                    <Icon icon="game-icons:discussion" width="22" height="22" className="inline" />
                    {thread.title}
                    {thread.is_closed && <span className="text-xs text-[var(--color-accent-danger)] border border-[var(--color-accent-danger)] rounded px-1.5 py-0.5">Закрыто</span>}
                    {isAuthor && (
                        <div className="flex gap-1 ml-auto">
                            {!thread.is_closed && (
                                <Button variant="secondary" size="md" onClick={() => { setNewTitle(thread.title); setEditingTitle(true); }}>✎</Button>
                            )}
                            <Button variant="secondary" size="md" onClick={handleToggleClose}>
                                {thread.is_closed ? 'Открыть' : 'Закрыть'}
                            </Button>
                        </div>
                    )}
                </h1>
            )}
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {poll && (
                <Card className="mb-4 border-l-4 border-l-[var(--color-accent-info)]">
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                        <Icon icon="game-icons:checked-shield" width="18" height="18" />
                        {poll.question}
                    </h3>
                    <div className="space-y-1.5">
                        {poll.options.map((opt: any) => {
                            const totalVotes = poll.options.reduce((s: number, o: any) => s + (o.votes_count || 0), 0);
                            const pct = totalVotes > 0 ? Math.round((opt.votes_count || 0) / totalVotes * 100) : 0;
                            return (
                                <div key={opt.id} className="text-sm">
                                    <button
                                        className="w-full text-left p-1.5 rounded border border-[var(--color-border-light)] hover:border-[var(--color-accent-info)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-default"
                                        onClick={() => handleVote(opt.id)}
                                        disabled={pollVoting || thread.is_closed}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{opt.option_text}</span>
                                            <span className="text-xs text-[var(--color-text-muted)]">{opt.votes_count || 0} голосов ({pct}%)</span>
                                        </div>
                                        <div className="mt-1 h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                            <div className="h-full bg-[var(--color-accent-info)] rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                        Всего голосов: {poll.options.reduce((s: number, o: any) => s + (o.votes_count || 0), 0)}
                    </p>
                </Card>
            )}

            {firstPost && <PostCard post={firstPost} onReply={handleReplyClick} isFirst={true} userId={user?.id} replyTargetId={replyParentId ?? undefined} isClosed={thread.is_closed} />}
            {tree.map(p => <PostCard key={p.id} post={p} children={p.children} onReply={handleReplyClick} userId={user?.id} replyTargetId={replyParentId ?? undefined} isClosed={thread.is_closed} />)}

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mb-4">
                    <Button variant="secondary" size="md" disabled={page <= 1} onClick={() => goToPage(page - 1)}>←</Button>
                    <span className="text-sm text-[var(--color-text-muted)]">{page}/{totalPages}</span>
                    <Button variant="secondary" size="md" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>→</Button>
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
                    <MdToolbar textareaId="reply-input" />
                    <textarea ref={replyRef} id="reply-input" className={inputClass + ' min-h-[150px] mb-2'} placeholder="Ваш ответ... (поддерживается Markdown)" value={replyText} onChange={e => setReplyText(e.target.value)} />
                    <Button variant="primary" size="md" onClick={handleReply} disabled={sending || !replyText.trim()}>{sending ? 'Отправка...' : 'Ответить'}</Button>
                </Card>
            )}
        </div>
    );
}
