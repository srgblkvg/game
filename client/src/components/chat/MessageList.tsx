import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ItemTooltip from '../ItemTooltip';
import { getRarityColor } from '../../utils/itemUtils';
import type { ChatMessage } from './types';

interface MessageListProps {
    messages: ChatMessage[];
    currentUserId: number;
    onNickClick: (e: React.MouseEvent, nick: string, isSelf: boolean) => void;
    renderContent?: (msg: ChatMessage) => React.ReactNode;
}

export default function MessageList({ messages, currentUserId, onNickClick, renderContent }: MessageListProps) {
    const [tooltipData, setTooltipData] = useState<{ item: any; x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevMessageCount = useRef(messages.length);
    const initialLoad = useRef(true);

    // Мгновенная прокрутка при первой загрузке, плавная при новых сообщениях
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
                behavior: 'smooth'
            });
        }

        prevMessageCount.current = currentCount;
    }, [messages]);

    // Сброс флага при монтировании заново
    useEffect(() => {
        initialLoad.current = true;
    }, []);

    const maxNickLength = 12;
    const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

    return (
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {messages.map(msg => {
                const isPrivate = msg.targetId !== null;
                const isOwn = msg.senderId === currentUserId;
                const prefix = isPrivate ? 'Шепот: ' : '';
                const color = isPrivate ? '#c084fc' : '#3498db';
                const fontWeight = isOwn ? 'bold' : 'normal';

                return (
                    <div key={msg.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                        marginBottom: '0.3rem', color: isPrivate ? '#c084fc' : undefined,
                    }}>
                        <span
                            style={{ fontWeight, color, fontSize: '0.8rem', cursor: isOwn ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                            onClick={(e) => onNickClick(e, msg.senderName, isOwn)}
                        >
                            {prefix}{truncate(msg.senderName)}
                        </span>

                        {msg.item ? (
                            <span
                                style={{
                                    color: getRarityColor(msg.itemRarity ?? 0),
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                }}
                                onMouseEnter={(e) => setTooltipData({ item: msg.item, x: e.clientX, y: e.clientY })}
                                onMouseMove={(e) => {
                                    if (tooltipData) setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                                }}
                                onMouseLeave={() => setTooltipData(null)}
                            >
                                [{msg.item.name}{msg.item.upgradeLevel > 0 ? ` +${msg.item.upgradeLevel}` : ''}]
                            </span>
                        ) : (
                            <span style={{ color: isPrivate ? '#c084fc' : '#eee', fontSize: '0.85rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {renderContent ? renderContent(msg) : msg.content}
                            </span>
                        )}

                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap' }}>
                            {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                    </div>
                );
            })}
            {tooltipData && <ItemTooltip item={tooltipData.item} position={{ x: tooltipData.x, y: tooltipData.y }} />}
        </div>
    );
}