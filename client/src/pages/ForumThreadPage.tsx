import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { fmtSafeDate } from '../utils/date';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';

const MAX_QUOTE_LENGTH = 300;

function stripQuotes(text: string): string {
    return text.split('\n').filter(line => !line.startsWith('>')).join('\n').trim();
}

function renderContent(content: string): string {
    const lines = content.split('\n');
    const parts: { type: 'quote' | 'text'; text: string }[] = [];
    let current = { type: 'text' as const, text: '' };
    for (const line of lines) {
        const isQuote = line.startsWith('>');
        if (isQuote !== (current.type === 'quote')) {
            if (current.text) parts.push(current);
            current = { type: isQuote ? 'quote' : 'text', text: '' };
        }
        current.text += (current.text ? '\n' : '') + (isQuote ? line.replace(/^>\s?/, '') : line);
    }
    if (current.text) parts.push(current);
    return parts.map((p, i) =>
        p.type === 'quote'
            ? `<blockquote class="border-l-2 border-[var(--color-accent-info)] pl-3 my-2 text-sm text-[var(--color-text-muted)]">${p.text}</blockquote>`
            : `<span>${p.text}</span>`
    ).join('\n');
}

function PostCard({ post, children, onReply, depth = 0, isFirst = false }: { post: any; children?: any[]; onReply: (text: string, parentId: number) => void; depth?: number; isFirst?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = post.content.length > 500;
    const displayContent = isLong && !expanded ? post.content.slice(0, 500) + '...' : post.content;
    const dateStr = fmtSafeDate(post.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className={depth > 0 ? 'ml-4 sm:ml-6 border-l-2 border-[var(--color-border-light)] pl-3' : ''}>
            <Card className={`mb-2 ${isFirst ? 'border-l-2 border-l-[var(--color-accent-warning)]' : ''}`}>
                <div className="flex items-start gap-3">
                    <img src={post.author_avatar || '/character_man.webp'} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-[var(--color-bg-input)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <a href={`/profile/${post.author_id}`} className="text-xs font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] no-underline" onClick={e => e.stopPropagation()}>{post.author_name}</a>
                            {post.author_guild && (
                                <a href={`/guild/${post.author_guild}`} className="text-[0.6rem] text-[var(--color-accent-success)] hover:underline no-underline" onClick={e => e.stopPropagation()}>[{post.author_guild_name}]</a>
                            )}
                            <span className="text-[0.6rem] text-[var(--color-text-muted)]">{dateStr}</span>
                            <span className="text-[0.6rem] text-[var(--color-text-muted)]">#{post.id}</span>
                            {isFirst && <span className="text-[0.55rem] text-[var(--color-accent-warning)] font-bold">Автор</span>}
                        </div>
                        <div className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: renderContent(displayContent) }} />
                        {isLong && (
                            <button className="text-xs text-[var(--color-accent-info)] mt-1 cursor-pointer hover:underline" onClick={() => setExpanded(!expanded)}>{expanded ? 'Свернуть' : 'Читать дальше'}</button>
                        )}
                        <button className="text-xs text-[var(--color-text-muted)] mt-1.5 cursor-pointer hover:text-[var(--color-accent-info)]"
                            onClick={() => {
                                const cleaned = stripQuotes(post.content.slice(0, MAX_QUOTE_LENGTH));
                                onReply(`> ${post.author_name}:\n> ${cleaned}\n\n`, post.id);
                                document.getElementById('reply-input')?.focus();
                            }}>Ответить</button>
                    </div>
                </div>
            </Card>
            {children && children.length > 0 && (
                <div>
                    {children.map((child: any) => (
                        <PostCard key={child.id} post={child} children={child.children} onReply={onReply} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ThreadPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [thread, setThread] = useState<any>(null);
    const [firstPost, setFirstPost] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPageState] = useState(() => {
        const p = searchParams.get('page');
        if (!p || p === 'last') return 0; // 0 = last page
        return parseInt(p) || 1;
    });
    const [replyText, setReplyText] = useState('');
    const [replyParentId, setReplyParentId] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const replyRef = useRef<HTMLTextAreaElement>(null);

    const load = async (pg = page) => {
        try {
            // If opening the thread fresh, find total pages first
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

    useEffect(() => { if (id) load(page); }, [id]);

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
            // After reply, go to last page
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
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:discussion" width="22" height="22" className="inline mr-2" />{thread.title}</h1>
            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {/* First post pinned */}
            {firstPost && <PostCard post={firstPost} onReply={handleReplyClick} isFirst={true} />}

            {/* Rest of posts */}
            {tree.map(p => <PostCard key={p.id} post={p} children={p.children} onReply={handleReplyClick} />)}

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mb-4">
                    <Button variant="secondary" size="xs" disabled={page <= 1} onClick={() => goToPage(page - 1)}>←</Button>
                    <span className="text-sm text-[var(--color-text-muted)]">{page}/{totalPages}</span>
                    <Button variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>→</Button>
                </div>
            )}

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
        </div>
    );
}
