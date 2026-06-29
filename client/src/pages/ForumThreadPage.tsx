import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { fmtSafeDate } from '../utils/date';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { inputClass } from '../utils/formStyles';

const MAX_QUOTE_LENGTH = 300;

function PostCard({ post, onReply }: { post: any; onReply: (text: string) => void }) {
    const textRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const isLong = post.content.length > 500;
    const displayContent = isLong && !expanded ? post.content.slice(0, 500) + '...' : post.content;

    return (
        <Card className="mb-3">
            <div className="flex items-start gap-3">
                <img
                    src={post.author_avatar || (post.author_name ? '/character_man.webp' : '')}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0 bg-[var(--color-bg-input)]"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <a href={`/profile/${post.author_id}`} className="text-sm font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] no-underline"
                            onClick={e => e.stopPropagation()}>{post.author_name}</a>
                        {post.author_guild && (
                            <a href={`/guild/${post.author_guild}`} className="text-xs text-[var(--color-accent-info)] hover:underline no-underline"
                                onClick={e => e.stopPropagation()}>[{post.author_guild_name}]</a>
                        )}
                        <span className="text-xs text-[var(--color-text-muted)]">{fmtSafeDate(post.createdAt)}</span>
                    </div>
                    <div ref={textRef} className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                        {displayContent}
                    </div>
                    {isLong && (
                        <button className="text-xs text-[var(--color-accent-info)] mt-1 cursor-pointer hover:underline"
                            onClick={() => setExpanded(!expanded)}>
                            {expanded ? 'Свернуть' : 'Читать дальше'}
                        </button>
                    )}
                    <button className="text-xs text-[var(--color-text-muted)] mt-2 cursor-pointer hover:text-[var(--color-accent-info)]"
                        onClick={() => {
                            const quote = post.content.slice(0, MAX_QUOTE_LENGTH);
                            const text = `> ${post.author_name}:\n> ${quote}\n\n`;
                            onReply(text);
                            document.getElementById('reply-input')?.focus();
                        }}>Ответить</button>
                </div>
            </div>
        </Card>
    );
}

export default function ThreadPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [thread, setThread] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const load = async (pg = 1) => {
        try {
            const res = await fetch(`/api/forum/thread/${id}?page=${pg}&limit=20`, { headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setThread(data.thread);
            setPosts(data.posts || []);
            setTotalPages(data.totalPages || 1);
            setPage(data.page || 1);
        } catch (e: any) { setError(e.message); }
    };

    useEffect(() => { if (id) load(); }, [id]);

    const handleReply = async () => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            const res = await fetch('/api/forum/reply', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ threadId: parseInt(id!), content: replyText }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setReplyText('');
            load(page);
        } catch (e: any) { setError(e.message); }
        finally { setSending(false); }
    };

    if (error && !thread) return <div className="p-4 text-[var(--color-accent-danger)]">{error}</div>;
    if (!thread) return <div className="p-4">Загрузка...</div>;

    return (
        <div className="px-4 py-4 max-w-3xl mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:discussion" width="22" height="22" className="inline mr-2" />{thread.title}</h1>

            {error && <p className="text-sm text-[var(--color-accent-danger)] mb-3">{error}</p>}

            {posts.map(p => <PostCard key={p.id} post={p} onReply={setReplyText} />)}

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mb-4">
                    <Button variant="secondary" size="xs" disabled={page <= 1} onClick={() => load(page - 1)}>←</Button>
                    <span className="text-sm text-[var(--color-text-muted)] self-center">{page}/{totalPages}</span>
                    <Button variant="secondary" size="xs" disabled={page >= totalPages} onClick={() => load(page + 1)}>→</Button>
                </div>
            )}

            <Card className="mt-4">
                <textarea
                    id="reply-input"
                    className={inputClass + ' min-h-[100px] mb-2'}
                    placeholder="Ваш ответ..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                />
                <Button variant="primary" size="sm" onClick={handleReply} disabled={sending || !replyText.trim()}>
                    {sending ? 'Отправка...' : 'Ответить'}
                </Button>
            </Card>
        </div>
    );
}
