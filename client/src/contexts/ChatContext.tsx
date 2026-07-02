import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface ChatMessage { id: number; senderId: number; senderName: string; targetId: number | null; content: string; createdAt: string; item?: any; itemRarity?: number; }
interface OnlineUser { id: number; username: string; level: number; }
interface ChatContextType {
  messages: ChatMessage[]; onlineUsers: OnlineUser[];
  addMessages: (msgs: ChatMessage[]) => void;
  sendPublic: (content: string) => void; sendPrivate: (targetUserId: number, content: string) => void;
  sendItemLink: (itemId: string, itemData?: any) => void;
  bannedUntil: number | null; chatError: string | null; setChatError: (msg: string | null) => void;
}
const ChatContext = createContext<ChatContextType | null>(null);
export function useGlobalChat() { const ctx = useContext(ChatContext); if (!ctx) throw new Error('useGlobalChat'); return ctx; }

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const c = localStorage.getItem('chat_messages');
      if (!c) return [];
      const parsed = JSON.parse(c);
      // Удаляем старые аукционные сообщения при загрузке — сервер пришлёт актуальные через WS
      return parsed.filter((m: any) => !m.item?.type?.startsWith('auction_'));
    } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('chat_messages', JSON.stringify(messages.slice(-100))); } catch {} }, [messages]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [bannedUntil, setBannedUntil] = useState<number | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Подключение WebSocket
  useEffect(() => {
    if (!token) return;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'serverTick': {
              const time = data.time || Math.floor(Date.now() / 1000);
              window.dispatchEvent(new CustomEvent('serverTick', { detail: time }));
              window.dispatchEvent(new CustomEvent('balance', { detail: { money: data.money, bank: data.bank || 0 } }));
              // Уведомления
              if (data.notifications && data.notifications.length > 0) {
                window.dispatchEvent(new CustomEvent('notifications', { detail: data.notifications }));
              }
              // Квесты
              if (data.quests) {
                window.dispatchEvent(new CustomEvent('questsUpdate', { detail: data.quests }));
              }
              // Рейтинг
              if (data.rating) {
                window.dispatchEvent(new CustomEvent('ratingUpdate', { detail: data.rating }));
              }
              // Резня: таймер и счётчик
              if (data.massacre) {
                window.dispatchEvent(new CustomEvent('massacreTick', { detail: data.massacre }));
              }
              // Аукцион: непрочитанные продажи
              if (data.auctionSales !== undefined) {
                localStorage.setItem('auctionBadge', String(data.auctionSales));
                window.dispatchEvent(new CustomEvent('auctionBadge'));
              }
              // Гильдия: заявки + приглашения + война (не растёт если просмотрено)
              if (data.guildBadge !== undefined) {
                const cur = parseInt(localStorage.getItem('guildBadge') || '0');
                const seen = parseInt(localStorage.getItem('guildBadgeSeen') || '0');
                if (data.guildBadge > seen) {
                  localStorage.setItem('guildBadge', String(data.guildBadge));
                  window.dispatchEvent(new CustomEvent('guildBadge'));
                } else if (data.guildBadge <= seen && cur !== 0) {
                  localStorage.setItem('guildBadge', '0');
                  window.dispatchEvent(new CustomEvent('guildBadge'));
                }
              }
              // Банк: входящие переводы
              if (data.bankTransfers !== undefined) {
                localStorage.setItem('bankBadge', String(data.bankTransfers));
                window.dispatchEvent(new CustomEvent('bankBadge'));
              }
              break;
            }
            case 'message': {
              const msg = data.message;
              if (msg) {
                setMessages(p => p.some(m => m.id === msg.id) ? p : [...p, msg].slice(-300));
                // ЛС-уведомление для сводки
                if (msg.targetId && msg.targetId > 0) {
                  window.dispatchEvent(new CustomEvent('privateMessage', { detail: msg }));
                }
              }
              break;
            }
            case 'onlineUsers': {
              setOnlineUsers(data.users || []);
              break;
            }
            case 'userOnline': {
              const u = data.user;
              if (u) setOnlineUsers(p => p.some(o => o.id === u.id) ? p : [...p, u]);
              break;
            }
            case 'userOffline': {
              setOnlineUsers(p => p.filter(o => o.id !== data.userId));
              break;
            }
            case 'chatBanned': {
              setBannedUntil(data.until || null);
              break;
            }
            case 'auction_changed': {
              window.dispatchEvent(new CustomEvent('auctionChanged'));
              break;
            }
            case 'auction_message_removed': {
              const lotId = data.lotId;
              if (lotId) {
                setMessages(p => p.filter(m => {
                  if (!m.item?.lotId) return true;
                  return m.item.lotId !== lotId;
                }));
              }
              break;
            }
            case 'guildQuestProgress': {
              if (data.activeQuest) {
                window.dispatchEvent(new CustomEvent('guildQuestProgress', { detail: data.activeQuest }));
              }
              break;
            }
            case 'tournamentCreated': {
              window.dispatchEvent(new CustomEvent('tournamentUpdated'));
              break;
            }
            case 'error': {
              setChatError(data.message || 'Ошибка');
              break;
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        console.log('[WS] disconnected, reconnect in 3s');
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
      }
    };
  }, [token]);

  // Автоснятие бана
  useEffect(() => { if (bannedUntil === null) return; const n = Date.now() / 1000; if (n >= bannedUntil) { setBannedUntil(null); setChatError(null); return; }
    const t = setTimeout(() => { setBannedUntil(null); setChatError(null); }, (bannedUntil - n) * 1000 + 100); return () => clearTimeout(t);
  }, [bannedUntil]);

  // Отправка сообщений через WS
  const sendWs = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      setChatError('Нет соединения с сервером');
    }
  }, []);

  const sendPublic = useCallback((content: string) => sendWs({ type: 'public', content }), [sendWs]);
  const sendPrivate = useCallback((targetUserId: number, content: string) => sendWs({ type: 'private', targetUserId, content }), [sendWs]);
  const sendItemLink = useCallback((itemId: string, itemData?: any) => sendWs({ type: 'itemLink', itemId, itemData }), [sendWs]);
  const addMessages = useCallback((n: ChatMessage[]) => { setMessages(p => { const ids = new Set(p.map(m => m.id)); const u = n.filter(m => !ids.has(m.id)); return u.length ? [...p, ...u].slice(-300) : p; }); }, []);

  return (<ChatContext.Provider value={{ messages, onlineUsers, addMessages, sendPublic, sendPrivate, sendItemLink, bannedUntil, chatError, setChatError }}>{children}</ChatContext.Provider>);
}
