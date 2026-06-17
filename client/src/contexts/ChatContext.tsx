import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fmtSafeDate } from '../utils/date';

interface ChatMessage {
    id: number;
    senderId: number;
    senderName: string;
    targetId: number | null;
    content: string;
    createdAt: string;
    item?: any;
    itemRarity?: number;
}

interface OnlineUser {
    id: number;
    username: string;
    level: number;
}

interface ChatContextType {
    messages: ChatMessage[];
    onlineUsers: OnlineUser[];
    addMessages: (msgs: ChatMessage[]) => void;
    sendPublic: (content: string) => void;
    sendPrivate: (targetUserId: number, content: string) => void;
    sendItemLink: (itemId: string, itemData?: any) => void;
    bannedUntil: number | null;
    chatError: string | null;
    setChatError: (msg: string | null) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useGlobalChat() {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useGlobalChat must be inside ChatProvider');
    return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const cached = localStorage.getItem('chat_messages');
            return cached ? JSON.parse(cached) : [];
        } catch { return []; }
    });

    // Кешируем сообщения в localStorage (все типы)
    useEffect(() => {
        try { localStorage.setItem('chat_messages', JSON.stringify(messages.slice(-100))); } catch {}
    }, [messages]);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [bannedUntil, setBannedUntil] = useState<number | null>(null);
    const [chatError, setChatError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const mountedRef = useRef(false);
    const lastTokenRef = useRef<string | null>(null);

    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 10;
    const reconnectBaseDelay = 1000; // 1 секунда

    const closeSocket = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.onclose = null;
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                wsRef.current.close();
            }
            wsRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        if (!token) return;
        if (wsRef.current) {
            closeSocket();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${window.location.host}/ws?token=${token}`;
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
            reconnectAttemptsRef.current = 0; // сброс при успешном подключении
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'onlineUsers') {
                    setOnlineUsers(data.users);
                } else if (data.type === 'message') {
                    setMessages(prev => {
                        if (prev.some(m => m.id === data.message.id)) return prev;
                        const next = [...prev, data.message];
                        // Ограничиваем размер массива – храним последние 300 сообщений
                        if (next.length > 300) {
                            return next.slice(-300);
                        }
                        return next;
                    });
                } else if (data.type === 'userOnline') {
                    setOnlineUsers(prev => {
                        if (!prev.find(u => u.id === data.user.id)) {
                            return [...prev, data.user];
                        }
                        return prev;
                    });
                } else if (data.type === 'userOffline') {
                    setOnlineUsers(prev => prev.filter(u => u.id !== data.userId));
                } else if (data.type === 'chatBanned') {
                    setBannedUntil(data.until);
                    setChatError(`Вы заблокированы в чате до ${fmtSafeDate(data.until)}`);
                } else if (data.type === 'error') {
                    setChatError(data.message);
                }
            } catch (e) {
                console.error('WebSocket message error', e);
            }
        };

        socket.onclose = () => {
            if (!mountedRef.current || !token || lastTokenRef.current !== token) return;
            reconnectAttemptsRef.current++;
            if (reconnectAttemptsRef.current > maxReconnectAttempts) {
                console.error('Достигнуто максимальное число попыток переподключения WebSocket');
                return;
            }
            const delay = Math.min(reconnectBaseDelay * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
            reconnectTimerRef.current = window.setTimeout(() => connect(), delay);
        };

        socket.onerror = () => { };
    }, [token, closeSocket]);

    useEffect(() => {
        mountedRef.current = true;

        if (token) {
            if (token !== lastTokenRef.current) {
                setMessages([]);
                setOnlineUsers([]);
                setBannedUntil(null);
                setChatError(null);
                closeSocket();
                lastTokenRef.current = token;
                connect();
            } else {
                if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                    connect();
                }
            }
        } else {
            closeSocket();
            lastTokenRef.current = null;
            setMessages([]);
            setOnlineUsers([]);
            setBannedUntil(null);
            setChatError(null);
        }

        return () => {
            mountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        };
    }, [token, connect, closeSocket]);

    useEffect(() => {
        if (bannedUntil === null) return;
        const now = Date.now() / 1000;
        if (now >= bannedUntil) {
            setBannedUntil(null);
            setChatError(null);
            return;
        }
        const remaining = (bannedUntil - now) * 1000;
        const timer = setTimeout(() => {
            setBannedUntil(null);
            setChatError(null);
        }, remaining + 100);
        return () => clearTimeout(timer);
    }, [bannedUntil]);

    const addMessages = useCallback((newMessages: ChatMessage[]) => {
        setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const unique = newMessages.filter(m => !existingIds.has(m.id));
            if (unique.length === 0) return prev;
            const combined = [...prev, ...unique];
            if (combined.length > 300) {
                return combined.slice(-300);
            }
            return combined;
        });
    }, []);

    const sendPublic = useCallback((content: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'public', content }));
        }
    }, []);

    const sendPrivate = useCallback((targetUserId: number, content: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'private', targetUserId, content }));
        }
    }, []);

    const sendItemLink = useCallback((itemId: string, itemData?: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'itemLink', itemId, itemData }));
        }
    }, []);

    return (
        <ChatContext.Provider value={{ messages, onlineUsers, addMessages, sendPublic, sendPrivate, sendItemLink, bannedUntil, chatError, setChatError }}>
            {children}
        </ChatContext.Provider>
    );
}