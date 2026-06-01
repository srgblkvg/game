import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { useGlobalChat } from '../../contexts/ChatContext';
import { fetchRecentMessages, fetchPrivateMessages, findUserByUsername } from '../../api/chat';
import { fetchUsersByIds, saveOpenTabs } from '../../api/character';
import ChatTabs from './ChatTabs';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import OnlineList from './OnlineList';
import ContextMenu from './ContextMenu';
import type { ChatMessage } from './types';

export default function ChatPanel() {
    const { user } = useAuth();
    const { character } = useGame();
    const auth = useAuth();
    const navigate = useNavigate();
    const userId = user?.id!;
    const currentUsername = character?.username || user?.username || '';
    const isPlayer = user?.role === 'player';
    const visible = isPlayer && auth.token;

    const [privateChatWith, setPrivateChatWith] = useState<number | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const { messages, onlineUsers, addMessages, sendPublic, sendPrivate, bannedUntil, chatError, setChatError } = useGlobalChat();

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; username: string } | null>(null);
    const [pendingMention, setPendingMention] = useState<string | null>(null);

    const [openPrivateTabs, setOpenPrivateTabs] = useState<Map<number, string>>(new Map());

    const panelRef = useRef<HTMLDivElement>(null);

    // Автоматическое скрытие чата при клике/тапе/скролле вне панели
    useEffect(() => {
        const handleInteraction = (e: Event) => {
            if (!isPanelOpen) return;
            const target = e.target as HTMLElement;
            if (panelRef.current && !panelRef.current.contains(target)) {
                setIsPanelOpen(false);
            }
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction, { passive: true });
        document.addEventListener('scroll', handleInteraction, { capture: true });

        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('scroll', handleInteraction, { capture: true });
        };
    }, [isPanelOpen]);

    // Инициализация вкладок из данных персонажа
    useEffect(() => {
        if (!character?.openPrivateTabs?.length) return;
        const ids = character.openPrivateTabs;
        fetchUsersByIds(ids)
            .then((users: { id: number; username: string }[]) => {
                const map = new Map<number, string>();
                users.forEach(u => map.set(u.id, u.username));
                setOpenPrivateTabs(map);
            })
            .catch(console.error);
    }, [character?.openPrivateTabs]);

    // Сохранение на сервер при изменениях
    const updateServerTabs = useCallback((tabs: Map<number, string>) => {
        const ids = Array.from(tabs.keys());
        saveOpenTabs(ids).catch(console.error);
    }, []);

    const addTab = useCallback((id: number, name: string) => {
        setOpenPrivateTabs(prev => {
            const next = new Map(prev);
            next.set(id, name);
            updateServerTabs(next);
            return next;
        });
    }, [updateServerTabs]);

    const removeTab = useCallback((id: number) => {
        setOpenPrivateTabs(prev => {
            const next = new Map(prev);
            next.delete(id);
            updateServerTabs(next);
            return next;
        });
    }, [updateServerTabs]);

    // Загрузка последних сообщений общего чата
    useEffect(() => {
        if (!auth.token || user?.role !== 'player') return;
        fetchRecentMessages(50)
            .then(data => addMessages(data))
            .catch(console.error);
    }, [auth.token, user?.role]);

    useEffect(() => {
        if (privateChatWith === null) return;
        fetchPrivateMessages(privateChatWith)
            .then((data: ChatMessage[]) => {
                if (data.length > 0) {
                    const last10 = data.slice(-10);
                    last10.sort((a: ChatMessage, b: ChatMessage) =>
                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );
                    addMessages(last10);
                }
            })
            .catch(console.error);
    }, [privateChatWith, addMessages]);

    const handleSend = useCallback((text: string) => {
        // Удаляем @ перед именами, которых нет в онлайне
        const cleanedText = text.replace(/@(\S+)/g, (match, name) => {
            if (onlineUsers.some(u => u.username.toLowerCase() === name.toLowerCase())) {
                return match;
            }
            return name;
        });

        if (cleanedText.startsWith('/w ')) {
            const withoutCommand = cleanedText.slice(3).trim();
            const spaceIndex = withoutCommand.indexOf(' ');
            if (spaceIndex === -1) return;
            const targetName = withoutCommand.slice(0, spaceIndex).toLowerCase();
            const content = withoutCommand.slice(spaceIndex + 1).trim();
            if (!content) return;
            const targetUser = onlineUsers.find(u => u.username.toLowerCase() === targetName);
            if (targetUser) {
                if (targetUser.id === userId) {
                    setChatError('Нельзя отправить личное сообщение самому себе');
                } else {
                    sendPrivate(targetUser.id, content);
                }
            } else {
                sendPublic(cleanedText);
            }
            return;
        }

        if (privateChatWith === null) {
            sendPublic(cleanedText);
        } else {
            sendPrivate(privateChatWith, cleanedText);
        }
    }, [privateChatWith, onlineUsers, sendPublic, sendPrivate]);

    const handleNickClick = useCallback((e: React.MouseEvent, nick: string, isSelf: boolean) => {
        if (isSelf) return;
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, username: nick });
    }, []);

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const handleReplyPublic = useCallback(() => {
        if (!contextMenu) return;
        setPendingMention('@' + contextMenu.username + ' ');
        closeContextMenu();
    }, [contextMenu, closeContextMenu]);

    const handleClearPending = useCallback(() => setPendingMention(null), []);

    const handleWhisper = useCallback(async () => {
        if (!contextMenu) return;
        const targetUser = onlineUsers.find(u => u.username === contextMenu.username);
        if (targetUser) {
            setPrivateChatWith(targetUser.id);
            addTab(targetUser.id, targetUser.username);
        } else {
            try {
                const found = await findUserByUsername(contextMenu.username);
                if (found && found.id) {
                    setPrivateChatWith(found.id);
                    addTab(found.id, found.username);
                }
            } catch (e) { }
        }
        closeContextMenu();
    }, [contextMenu, onlineUsers, closeContextMenu, addTab]);

    const handleProfile = useCallback(async () => {
        if (!contextMenu) return;
        closeContextMenu();
        const onlineUser = onlineUsers.find(u => u.username.toLowerCase() === contextMenu.username.toLowerCase());
        if (onlineUser) {
            navigate(`/profile/${onlineUser.id}`);
            return;
        }
        try {
            const found = await findUserByUsername(contextMenu.username);
            if (found?.id) {
                navigate(`/profile/${found.id}`);
            } else {
                alert('Игрок не найден');
            }
        } catch (e) {
            alert('Не удалось найти игрока');
        }
    }, [contextMenu, onlineUsers, navigate]);

    // Слушаем глобальное событие открытия ЛС (из профиля)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.id && detail?.name) {
                setPrivateChatWith(detail.id);
                addTab(detail.id, detail.name);
                if (detail.shouldOpenPanel) {
                    setIsPanelOpen(true);
                }
            }
        };
        window.addEventListener('openPrivateChat', handler);
        return () => window.removeEventListener('openPrivateChat', handler);
    }, [addTab]);

    const renderMessageContent = useCallback((msg: ChatMessage) => {
        const parts = msg.content.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const name = part.slice(1);
                const isSelfMention = name.toLowerCase() === currentUsername.toLowerCase();
                return (
                    <span
                        key={i}
                        style={{
                            color: '#f1c40f',
                            cursor: isSelfMention ? 'default' : 'pointer',
                            textDecoration: isSelfMention ? 'none' : 'underline',
                            opacity: isSelfMention ? 0.7 : 1,
                        }}
                        onClick={isSelfMention ? undefined : (e) => handleNickClick(e, name, false)}
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    }, [currentUsername, handleNickClick]);

    const displayedMessages = useMemo(() => messages.filter(msg => {
        if (privateChatWith === null) {
            return msg.targetId === null || msg.senderId === userId || msg.targetId === userId;
        }
        return (msg.senderId === userId && msg.targetId === privateChatWith) ||
            (msg.senderId === privateChatWith && msg.targetId === userId);
    }), [messages, privateChatWith, userId]);

    const openPrivateTabsArray = useMemo(() =>
        Array.from(openPrivateTabs.entries()).map(([id, name]) => ({ id, name })),
        [openPrivateTabs]);

    return (
        <div ref={panelRef} className="chat-panel" style={{
            position: 'fixed', bottom: 0, left: 0, width: '100%',
            height: isPanelOpen ? 'min(300px, 50vh)' : '40px', transition: 'height 0.3s',
            background: '#1e1e30', borderTop: '2px solid #555',
            display: visible ? 'flex' : 'none',
            flexDirection: 'column', zIndex: 1000,
        }}>
            <div onClick={() => setIsPanelOpen(!isPanelOpen)} style={{
                cursor: 'pointer', padding: '0.5rem', background: '#2a2a3e',
                borderBottom: '1px solid #444', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span><Icon icon="game-icons:chat-bubble" width="18" height="18" className="inline mr-1" />Чат ({onlineUsers.length}) {privateChatWith && `– личные с ${openPrivateTabs.get(privateChatWith) || 'ID:' + privateChatWith}`}</span>
                <span>{isPanelOpen ? '▼' : '▲'}</span>
            </div>

            {isPanelOpen && (
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <ChatTabs
                            privateChatWith={privateChatWith}
                            openPrivateTabs={openPrivateTabsArray}
                            onSelectPublic={() => setPrivateChatWith(null)}
                            onSelectPrivate={(id) => setPrivateChatWith(id)}
                            onCloseTab={(e, id) => {
                                e.stopPropagation();
                                removeTab(id);
                                if (privateChatWith === id) setPrivateChatWith(null);
                            }}
                        />

                        <div style={{ padding: '0.3rem 0.5rem', background: '#2a2a3e', flexShrink: 0 }}>
                            {privateChatWith !== null
                                ? <span>Личные сообщения с {openPrivateTabs.get(privateChatWith) || 'ID:' + privateChatWith}</span>
                                : <span>Общий чат</span>}
                        </div>

                        <MessageList
                            messages={displayedMessages}
                            currentUserId={userId}
                            onNickClick={handleNickClick}
                            renderContent={renderMessageContent}
                        />

                        <ChatInput
                            isPrivate={privateChatWith !== null}
                            onlineUsers={onlineUsers}
                            currentUserId={userId}
                            onSend={handleSend}
                            bannedUntil={bannedUntil}
                            chatError={chatError}
                            pendingMention={pendingMention}
                            onClearPending={handleClearPending}
                        />
                    </div>

                    <OnlineList
                        users={onlineUsers}
                        currentUserId={userId}
                        privateChatWith={privateChatWith}
                        onUserClick={handleNickClick}
                    />
                </div>
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x} y={contextMenu.y} username={contextMenu.username}
                    onReply={handleReplyPublic}
                    onWhisper={handleWhisper}
                    onProfile={handleProfile}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
}