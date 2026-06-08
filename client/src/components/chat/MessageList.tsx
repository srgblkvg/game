import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemTooltip from '../ItemTooltip';
import { getRarityColor } from '../../utils/itemUtils';
import type { ChatMessage } from './types';

interface MessageListProps {
    messages: ChatMessage[];
    currentUserId: number;
    onNickClick: (e: React.MouseEvent, nick: string, isSelf: boolean) => void;
    renderContent?: (msg: ChatMessage) => React.ReactNode;
    scrollKey?: number;
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
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

export default function MessageList({ messages, currentUserId, onNickClick, renderContent, scrollKey }: MessageListProps) {
    const navigate = useNavigate();
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevMessageCount = useRef(messages.length);
    const initialLoad = useRef(true);

    // Сброс при смене вкладки
    useEffect(() => {
        initialLoad.current = true;
        prevMessageCount.current = 0;
    }, [scrollKey]);

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
            className="flex-1 overflow-y-auto px-[0.5rem] py-[0.6rem] flex flex-col gap-[2px]"
        >
            {groups.map((group, gi) => {
                const firstMsg = group[0];
                const isOwn = firstMsg.senderId === currentUserId;
                const isPrivate = firstMsg.targetId !== null && firstMsg.targetId > 0;
                const isGuild = firstMsg.targetId !== null && firstMsg.targetId < 0;

                return (
                    <div
                        key={gi}
                        className={`flex flex-col mb-1.5 ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                        {/* Nickname row */}
                        <div
                            className={`flex items-center gap-1 mb-0.5 ${isOwn ? 'pr-3' : 'pl-3'}`}
                        >
                            <span
                                className={`text-[0.72rem] font-semibold select-none ${
                                    isGuild ? 'text-[#2ecc71]' : isPrivate ? 'text-[#c084fc]' : 'text-[#aaa]'
                                } ${isOwn ? 'cursor-default' : 'cursor-pointer'}`}
                                onClick={isOwn ? undefined : (e) => onNickClick(e, firstMsg.senderName, false)}
                            >
                                {truncate(firstMsg.senderName)}
                            </span>
                            {firstMsg.senderGuild && (
                                <span
                                    onClick={() =>
                                        firstMsg.senderGuildId
                                            ? navigate(`/guild/${firstMsg.senderGuildId}`)
                                            : navigate('/guild/rating')
                                    }
                                    className="text-[0.6rem] text-[#2ecc71] cursor-pointer px-1 rounded-[3px]"
                                >
                                    [{firstMsg.senderGuild.length > 8 ? firstMsg.senderGuild.slice(0, 8) + '\u2026' : firstMsg.senderGuild}]
                                </span>
                            )}
                            <span className="text-[0.62rem] text-[#555]">
                                {formatTime(firstMsg.createdAt)}
                            </span>
                        </div>

                        {/* Bubble(s) */}
                        <div
                            className={`flex flex-col gap-[2px] max-w-[85%] ${isOwn ? 'items-end' : 'items-start'}`}
                        >
                            {group.map((msg) =>
                                msg.item && msg.item.type !== 'guild_invite' ? (
                                    /* Item link bubble */
                                    <div
                                        key={msg.id}
                                        style={{ color: getRarityColor(msg.itemRarity ?? 0) }}
                                        className={`px-[10px] py-[6px] font-bold cursor-pointer text-[0.82rem] break-words shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${
                                            isOwn
                                                ? 'rounded-[12px_12px_4px_12px] bg-[linear-gradient(135deg,#3b5998,#4a6fa5)] border border-[rgba(255,255,255,0.08)]'
                                                : `rounded-[12px_12px_12px_4px] ${isPrivate ? 'bg-[#2d1f3d]' : 'bg-[#2a2a3e]'} border border-[rgba(255,255,255,0.04)]`
                                        }`}
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
                                        className={`px-3 py-[7px] break-words shadow-[0_1px_3px_rgba(0,0,0,0.35)] text-[0.85rem] leading-[1.4] ${
                                            isOwn
                                                ? 'rounded-[12px_12px_4px_12px] bg-[linear-gradient(135deg,#3b5998,#4a6fa5)] text-[#eaeaea] border border-[rgba(255,255,255,0.08)]'
                                                : `rounded-[12px_12px_12px_4px] border border-[rgba(255,255,255,0.04)] ${
                                                    isGuild
                                                        ? 'bg-[#1a3a1a] text-[#2ecc71]'
                                                        : isPrivate
                                                            ? 'bg-[#2d1f3d] text-[#c084fc]'
                                                            : 'bg-[#2a2a3e] text-[#eaeaea]'
                                                }`
                                        }`}
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
