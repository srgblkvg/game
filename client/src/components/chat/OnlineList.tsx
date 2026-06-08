import { useState, useRef, useCallback, useEffect } from 'react';
import type { OnlineUser } from './types';

interface OnlineListProps {
    users: OnlineUser[];
    currentUserId: number;
    privateChatWith: number | null;
    guildMemberIds: Set<number>;
    onUserClick: (e: React.MouseEvent, username: string, isSelf: boolean) => void;
}

export default function OnlineList({ users, currentUserId, privateChatWith, guildMemberIds, onUserClick }: OnlineListProps) {
    const [filter, setFilter] = useState<'all' | 'guild'>('all');
    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem('onlineListWidth');
        return saved ? parseInt(saved) : 160;
    });
    const widthRef = useRef(width);
    useEffect(() => { widthRef.current = width; }, [width]);

    const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const startW = widthRef.current;
        const onMove = (ev: MouseEvent | TouchEvent) => {
            const x = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
            const delta = startX - x;
            const w = Math.max(100, Math.min(400, startW + delta));
            setWidth(Math.round(w));
        };
        const onEnd = () => {
            localStorage.setItem('onlineListWidth', String(widthRef.current));
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    }, []);

    const sorted = users.slice().sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return 0;
    });

    const filtered = filter === 'guild'
        ? sorted.filter(u => u.id === currentUserId || guildMemberIds.has(u.id))
        : sorted;

    const maxNickLength = 12;
    const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '\u2026' : nick;

    const guildCount = sorted.filter(u => guildMemberIds.has(u.id)).length;

    return (
        <div className="online-panel bg-[#16162a] max-h-full flex flex-col shrink-0 relative" style={{ width }}>
            {/* Drag handle on left border */}
            <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                className="absolute left-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-[#555] z-10 select-none flex items-center justify-center group"
                title="Тяни для изменения ширины"
            >
                <span className="text-[0.55rem] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]" style={{ writingMode: 'vertical-rl' }}>⠿</span>
            </div>
            <div className="flex shrink-0 border-b border-l border-[#444]">
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-1 text-[0.7rem] cursor-pointer ${filter === 'all' ? 'bg-[#2a2a3e] text-white' : 'bg-transparent text-[var(--color-text-muted)]'}`}
                >Все</button>
                <button
                    onClick={() => setFilter('guild')}
                    className={`flex-1 py-1 text-[0.7rem] cursor-pointer border-l border-[#444] ${filter === 'guild' ? 'bg-[#2a2a3e] text-[#2ecc71]' : 'bg-transparent text-[var(--color-text-muted)]'}`}
                >Гильдия{guildCount > 0 ? ` (${guildCount})` : ''}</button>
            </div>
            <ul className="list-none p-0 m-0 overflow-y-auto">
                {filtered.map((u, i) => {
                    const isMe = u.id === currentUserId;
                    const isGuildMate = guildMemberIds.has(u.id);
                    return (
                        <li
                            key={u.id}
                            onClick={isMe ? undefined : (e) => onUserClick(e, u.username, false)}
                            className={`py-[0.2rem] px-1 text-[0.8rem] whitespace-nowrap ${i % 2 === 1 ? 'bg-[#1e1e38]' : ''} ${
                                isMe
                                    ? 'cursor-default text-[#f1c40f] font-normal'
                                    : privateChatWith === u.id
                                        ? 'cursor-pointer text-[#f1c40f] font-bold'
                                        : isGuildMate
                                            ? 'cursor-pointer text-[#2ecc71] font-normal'
                                            : 'cursor-pointer text-white font-normal'
                            }`}
                        >
                            {truncate(u.username)}
                            {isMe && ' (Вы)'}
                            {' '}[<span className="text-white">{u.level}</span>]
                            {u.guildName && <span className="text-[0.65rem] text-[#2ecc71] ml-1">[{u.guildName.length > 8 ? u.guildName.slice(0, 8) + '\u2026' : u.guildName}]</span>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
