import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemTooltip from '../ItemTooltip';
import { getRarityColor } from '../../utils/itemUtils';
import { formatGameTime } from '../../utils/time';
import type { ChatMessage } from './types';

interface MessageListProps {
    messages: ChatMessage[];
    currentUserId: number;
    onNickClick: (e: React.MouseEvent, nick: string, isSelf: boolean) => void;
    renderContent?: (msg: ChatMessage) => React.ReactNode;
    scrollKey?: number;
}

function formatTime(dateStr: string): string {
    return formatGameTime(dateStr);
}

const MAX_NICK_LENGTH = 14;

function truncate(nick: string | null): string {
    if (!nick) return 'Система';
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
        <>
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto overflow-x-auto px-[0.5rem] py-[0.6rem] flex flex-col gap-[2px] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[var(--color-border-light)] [&::-webkit-scrollbar-thumb]:rounded"
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
                                        isGuild ? 'text-[var(--color-accent-success)]' : isPrivate ? 'text-[var(--color-accent-purple)]' : 'text-[var(--color-text-muted)]'
                                    } ${isOwn ? 'cursor-default' : 'cursor-pointer'}`}
                                    onClick={isOwn || !firstMsg.senderName ? undefined : (e) => onNickClick(e, firstMsg.senderName!, false)}
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
                                        className="text-[0.6rem] text-[var(--color-accent-success)] cursor-pointer px-1 rounded-[3px]"
                                    >
                                        [{firstMsg.senderGuild.length > 8 ? firstMsg.senderGuild.slice(0, 8) + '\u2026' : firstMsg.senderGuild}]
                                    </span>
                                )}
                                <span className="text-[0.62rem] text-[var(--color-border-light)]">
                                    {formatTime(firstMsg.createdAt)}
                                </span>
                            </div>

                            {/* Bubble(s) */}
                            <div
                                className={`flex flex-col gap-[2px] max-w-[85%] ${isOwn ? 'items-end' : 'items-start'}`}
                            >
                                {group.map((msg) => {
                                    const isAuction = msg.item?.type?.startsWith('auction_');
                                    if (isAuction) {
                                        const a = msg.item;
                                        const itemName = a.itemData?.name || 'Предмет';
                                        const rarity = a.itemData?.rarity_id ?? 0;
                                        const now = Math.floor(Date.now() / 1000);
                                        const timeLeft = Math.max(0, (a.endsAt || 0) - now);
                                        const hours = Math.floor(timeLeft / 3600);
                                        const mins = Math.floor((timeLeft % 3600) / 60);
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.35)] text-[0.82rem] leading-[1.4] rounded-[8px] bg-[var(--color-bg-input)] border border-[var(--color-border-light)] max-w-[90%] cursor-pointer hover:border-[var(--color-accent-warning)]`}
                                                onClick={() => a.lotId && navigate(`/auction?lot=${a.lotId}`)}
                                            >
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span
                                                        style={{ color: getRarityColor(rarity) }}
                                                        className="font-bold cursor-pointer hover:underline"
                                                        onMouseEnter={(e) => setTooltipData({ item: a.itemData, x: e.clientX, y: e.clientY })}
                                                        onMouseMove={(e) => { if (tooltipData) setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null); }}
                                                        onMouseLeave={() => setTooltipData(null)}
                                                    >
                                                        [{itemName}{a.itemData?.upgradeLevel > 0 ? ` +${a.itemData.upgradeLevel}` : ''}]
                                                    </span>
                                                    <span className="text-[var(--color-text-muted)] text-[0.7rem]">
                                                        {a.type === 'auction_lot' ? '📦 Новый лот' : a.type === 'auction_bid' ? '💰 Ставка' : '✅ Выкуп'}
                                                    </span>
                                                </div>
                                                {a.type === 'auction_lot' && (
                                                    <>
                                                        <div className="text-[var(--color-text-primary)]">
                                                            Старт: <span className="text-[var(--color-accent-warning)] font-bold">{a.startPrice} серебра</span>
                                                            {a.buyoutPrice ? <span className="ml-2">Выкуп: <span className="text-[var(--color-accent-success)] font-bold">{a.buyoutPrice} серебра</span></span> : null}
                                                        </div>
                                                        <div className="text-[var(--color-text-muted)] text-[0.72rem]">
                                                            Продавец: {a.sellerName || '?'}
                                                            {a.currentBidderName ? null : ' • Нет покупателя'}
                                                        </div>
                                                    </>
                                                )}
                                                {a.type === 'auction_bid' && (
                                                    <>
                                                        <div className="text-[var(--color-text-primary)]">
                                                            Ставка: <span className="text-[var(--color-accent-warning)] font-bold">{a.currentBid} серебра</span>
                                                            {a.buyoutPrice ? <span className="ml-2">Выкуп: <span className="text-[var(--color-accent-success)]">{a.buyoutPrice} серебра</span></span> : null}
                                                        </div>
                                                        <div className="text-[var(--color-text-muted)] text-[0.72rem]">
                                                            Лидер: <span className="text-[var(--color-accent-warning)] font-bold">{a.currentBidderName || '?'}</span>
                                                            {a.previousBidderName ? <span> (перебил {a.previousBidderName})</span> : null}
                                                        </div>
                                                    </>
                                                )}
                                                {a.type === 'auction_buyout' && (
                                                    <div className="text-[var(--color-text-muted)] text-[0.72rem]">
                                                        {a.buyerName} выкупил за {a.price} серебра
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center mt-1 text-[0.68rem] text-[var(--color-border-light)]">
                                                    <span>{formatTime(msg.createdAt)}</span>
                                                    {a.type !== 'auction_buyout' && (
                                                        <span className={timeLeft < 3600 ? 'text-[var(--color-accent-danger)]' : 'text-[var(--color-accent-success)]'}>
                                                            {timeLeft > 0 ? `⏳ ${hours}ч ${mins}м` : '⏳ Истёк'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (msg.item && msg.item.type !== 'guild_invite' && msg.item.type !== 'war_declared') return (
                                        /* Item link bubble */
                                        <div
                                            key={msg.id}
                                            style={{ color: getRarityColor(msg.itemRarity ?? 0) }}
                                            className={`px-[10px] py-[6px] font-bold cursor-pointer text-[0.82rem] break-words shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${
                                                isOwn
                                                    ? 'rounded-[12px_12px_4px_12px] bg-[var(--color-chat-own-bg)] border border-[rgba(255,255,255,0.08)]'
                                                    : `rounded-[12px_12px_12px_4px] ${isPrivate ? 'bg-[var(--color-chat-private-bg)]' : 'bg-[var(--color-chat-public-bg)]'} border border-[rgba(255,255,255,0.04)]`
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
                                    );
                                    /* Text bubble */
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`px-3 py-[7px] break-words shadow-[0_1px_3px_rgba(0,0,0,0.35)] text-[0.85rem] leading-[1.4] ${
                                                isOwn
                                                    ? 'rounded-[12px_12px_4px_12px] bg-[var(--color-chat-own-bg)] text-[var(--color-chat-own-text)] border border-[rgba(255,255,255,0.08)]'
                                                    : `rounded-[12px_12px_12px_4px] border border-[rgba(255,255,255,0.04)] ${
                                                        isGuild
                                                            ? 'bg-[var(--color-chat-guild-bg)] text-[var(--color-chat-guild-text)]'
                                                            : isPrivate
                                                                ? 'bg-[var(--color-chat-private-bg)] text-[var(--color-chat-private-text)]'
                                                                : 'bg-[var(--color-chat-public-bg)] text-[var(--color-chat-public-text)]'
                                                    }`
                                            }`}
                                        >
                                            {renderContent ? renderContent(msg) : msg.content}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Tooltip rendered OUTSIDE scrollable container to avoid clipping */}
            {tooltipData && (
                <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />
            )}
        </>
    );
}
