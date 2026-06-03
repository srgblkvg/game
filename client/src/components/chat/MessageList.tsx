import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import ItemTooltip from '../ItemTooltip';
import { getRarityColor } from '../../utils/itemUtils';
import type { ChatMessage } from './types';

interface MessageListProps {
    messages: ChatMessage[];
    currentUserId: number;
    onNickClick: (e: React.MouseEvent, nick: string, isSelf: boolean) => void;
    renderContent?: (msg: ChatMessage) => React.ReactNode;
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

const MAX_NICK_LENGTH = 14;

function truncate(nick: string): string {
    return nick.length > MAX_NICK_LENGTH ? nick.slice(0, MAX_NICK_LENGTH) + '\u2026' : nick;
}

/** Group messages by sender + within 2 minutes gap → same bubble group */
function groupMessages(messages: ChatMessage[]): ChatMessage[][] {
    const groups: ChatMessage[][] = [];
    for (const msg of messages) {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup) {
            const lastMsg = lastGroup[lastGroup.length - 1];
            const sameSender = lastMsg.senderId === msg.senderId;
            const withinTime =
                Math.abs(new Date(msg.createdAt).getTime() - new Date(lastMsg.createdAt).getTime()) < 120_000;
            if (sameSender && withinTime) {
                lastGroup.push(msg);
                continue;
            }
        }
        groups.push([msg]);
    }
    return groups;
}

export default function MessageList({ messages, currentUserId, onNickClick, renderContent }: MessageListProps) {
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevMessageCount = useRef(messages.length);
    const initialLoad = useRef(true);

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const prevCount = prevMessageCount.current;
        const currentCount = messages.length;

        if (initialLoad.current && currentCount > 0) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            initialLoad.current = false;
        } else if (prevCount > 0 && currentCount > prevCount) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }

        prevMessageCount.current = currentCount;
    }, [messages]);

    useEffect(() => {
        initialLoad.current = true;
    }, []);

    const groups = useMemo(() => groupMessages(messages), [messages]);

    return (
        <div
            ref={containerRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.6rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
            }}
        >
            {groups.map((group, gi) => {
                const firstMsg = group[0];
                const isOwn = firstMsg.senderId === currentUserId;
                const isPrivate = firstMsg.targetId !== null;

                return (
                    <div
                        key={gi}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isOwn ? 'flex-end' : 'flex-start',
                            marginBottom: '6px',
                        }}
                    >
                        {/* Nickname row */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginBottom: '2px',
                                paddingLeft: isOwn ? '0' : '12px',
                                paddingRight: isOwn ? '12px' : '0',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '0.72rem',
                                    color: isPrivate ? '#c084fc' : '#aaa',
                                    fontWeight: 600,
                                    cursor: isOwn ? 'default' : 'pointer',
                                    userSelect: 'none',
                                }}
                                onClick={isOwn ? undefined : (e) => onNickClick(e, firstMsg.senderName, false)}
                            >
                                {truncate(firstMsg.senderName)}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: '#555' }}>
                                {formatTime(firstMsg.createdAt)}
                            </span>
                        </div>

                        {/* Bubble(s) */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isOwn ? 'flex-end' : 'flex-start',
                                gap: '2px',
                                maxWidth: '85%',
                            }}
                        >
                            {group.map((msg) =>
                                msg.item ? (
                                    /* Item link bubble */
                                    <div
                                        key={msg.id}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                            background: isOwn
                                                ? 'linear-gradient(135deg, #3b5998, #4a6fa5)'
                                                : isPrivate
                                                  ? '#2d1f3d'
                                                  : '#2a2a3e',
                                            color: getRarityColor(msg.itemRarity ?? 0),
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            wordBreak: 'break-word',
                                            overflowWrap: 'break-word',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                            border: isOwn
                                                ? '1px solid rgba(255,255,255,0.08)'
                                                : '1px solid rgba(255,255,255,0.04)',
                                        }}
                                        onMouseEnter={(e) =>
                                            setTooltipData({ item: msg.item, x: e.clientX, y: e.clientY })
                                        }
                                        onMouseMove={(e) => {
                                            if (tooltipData)
                                                setTooltipData((prev) =>
                                                    prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                                                );
                                        }}
                                        onMouseLeave={() => setTooltipData(null)}
                                    >
                                        [{msg.item.name}
                                        {msg.item.upgradeLevel > 0 ? ` +${msg.item.upgradeLevel}` : ''}]
                                    </div>
                                ) : (
                                    /* Text bubble */
                                    <div
                                        key={msg.id}
                                        style={{
                                            padding: '7px 12px',
                                            borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                            background: isOwn
                                                ? 'linear-gradient(135deg, #3b5998, #4a6fa5)'
                                                : isPrivate
                                                  ? '#2d1f3d'
                                                  : '#2a2a3e',
                                            color: isPrivate ? '#c084fc' : '#eaeaea',
                                            fontSize: '0.85rem',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word',
                                            overflowWrap: 'break-word',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                                            border: isOwn
                                                ? '1px solid rgba(255,255,255,0.08)'
                                                : '1px solid rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        {renderContent ? renderContent(msg) : msg.content}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                );
            })}
            {tooltipData && (
                <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />
            )}
        </div>
    );
}
