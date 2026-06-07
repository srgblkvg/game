import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { useGlobalChat } from '../../contexts/ChatContext';
import { fetchRecentMessages, fetchPrivateMessages, findUserByUsername } from '../../api/chat';
import { fetchUsersByIds, saveOpenTabs } from '../../api/character';
import { fetchCharacter } from '../../api/character';
import { getHeaders, BASE_URL } from '../../api/helpers';
import ChatTabs from './ChatTabs';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import OnlineList from './OnlineList';
import ContextMenu from './ContextMenu';
import type { ChatMessage } from './types';

export default function ChatPanel() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
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
    const [guildChatActive, setGuildChatActive] = useState(false);
    const [guildId, setGuildId] = useState<number | null>(null);
    const [guildName, setGuildName] = useState<string | null>(null);

    // Непрочитанные сообщения
    const [unreadGeneral, setUnreadGeneral] = useState(0);
    const [unreadPrivate, setUnreadPrivate] = useState<Map<number, number>>(new Map());
    const [unreadGuild, setUnreadGuild] = useState(0);

    // Отслеживаем новые сообщения
    useEffect(() => {
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (last.senderId === userId) return; // свои не считаем
        if (last.targetId === null && (privateChatWith !== null || guildChatActive || !isPanelOpen)) {
            setUnreadGeneral(c => c + 1);
        } else if (last.targetId !== null && last.targetId < 0 && (!guildChatActive || !isPanelOpen)) {
            setUnreadGuild(c => c + 1);
        } else if (last.targetId !== null && last.targetId > 0 && last.targetId === userId) {
            const fromId = last.senderId;
            const fromName = last.senderName;
            if (!isPanelOpen || privateChatWith !== fromId) {
                setUnreadPrivate(prev => {
                    const next = new Map(prev);
                    next.set(fromId, (next.get(fromId) || 0) + 1);
                    return next;
                });
            }
            addTab(fromId, fromName);
        }
    }, [messages.length]);

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

    // Загрузка инфы о гильдии
    useEffect(() => {
        if (user?.role !== 'player') return;
        fetch(`${BASE_URL}/guild/my`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                if (data.guild) {
                    setGuildId(data.guild.id);
                    setGuildName(data.guild.name);
                }
            })
            .catch(() => {});
    }, [user?.role, character?.guildId]);

    // Гильд-чат: не грузим историю, сообщения приходят через WS и кешируются в localStorage

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

        // /g — гильд-чат
        if (cleanedText.startsWith('/g ')) {
            const content = cleanedText.slice(3).trim();
            const gid = guildId || (character as any)?.guildId;
            if (!content || !gid) return;
            fetch(`${BASE_URL}/guild/chat`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ content }),
            }).then(r => r.json()).then(d => {
                if (d.message) addMessages([d.message]);
            }).catch(console.error);
            return;
        }

        if (privateChatWith === null) {
            if (guildChatActive && (guildId || (character as any)?.guildId)) {
                const gid = guildId || (character as any)?.guildId;
                console.log('[guild-chat] sending to guild', gid, cleanedText);
                fetch(`${BASE_URL}/guild/chat`, {
                    method: 'POST', headers: getHeaders(),
                    body: JSON.stringify({ content: cleanedText }),
                }).then(r => r.json()).then(d => {
                    if (d.message) addMessages([d.message]);
                }).catch(console.error);
            } else {
                sendPublic(cleanedText);
            }
        } else {
            sendPrivate(privateChatWith, cleanedText);
        }
    }, [privateChatWith, guildChatActive, guildId, character, onlineUsers, sendPublic, sendPrivate, setChatError, addMessages]);

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
        const acceptInvite = async () => {
            try {
                await fetch(`${BASE_URL}/guild/accept-invite`, {
                    method: 'POST', headers: getHeaders(),
                    body: JSON.stringify({ guildId: msg.item.guildId, accept: true }),
                });
                const fresh = await fetchCharacter();
                setCharacter(fresh);
                // Помечаем как использованное — кнопки исчезнут
                msg.item = { ...msg.item, used: true };
            } catch(e) { console.error(e); }
        };
        const declineInvite = async () => {
            try {
                await fetch(`${BASE_URL}/guild/accept-invite`, {
                    method: 'POST', headers: getHeaders(),
                    body: JSON.stringify({ guildId: msg.item.guildId, accept: false }),
                });
                msg.item = { ...msg.item, used: true };
            } catch(e) { console.error(e); }
        };
        const isGuildInvite = msg.item?.type === 'guild_invite' && !character?.guildId && !msg.item?.used;
        return (
            <div>
                <div>
                    {parts.map((part, i) => {
                        if (part.startsWith('@')) {
                            const name = part.slice(1);
                            const isSelfMention = name.toLowerCase() === currentUsername.toLowerCase();
                            return (
                                <span
                                    key={i}
                                    className={`text-[#f1c40f] ${isSelfMention ? 'cursor-default opacity-70' : 'cursor-pointer underline'}`}
                                    onClick={isSelfMention ? undefined : (e) => handleNickClick(e, name, false)}
                                >
                                    {part}
                                </span>
                            );
                        }
                        return part;
                    })}
                </div>
                {isGuildInvite && msg.item && (
                    <div className="mt-1.5 flex gap-1.5">
                        <button
                            onClick={acceptInvite}
                            className="px-2.5 py-0.5 text-xs bg-[#27ae60] text-white border-none rounded cursor-pointer"
                        >
                            Принять
                        </button>
                        <button
                            onClick={declineInvite}
                            className="px-2.5 py-0.5 text-xs bg-[#e74c3c] text-white border-none rounded cursor-pointer"
                        >
                            Отклонить
                        </button>
                    </div>
                )}
            </div>
        );
    }, [currentUsername, handleNickClick, setCharacter]);

    const displayedMessages = useMemo(() => messages.filter(msg => {
        if (guildChatActive && guildId) {
            return msg.targetId === -guildId;
        }
        if (privateChatWith === null) {
            return msg.targetId === null;
        }
        return (msg.senderId === userId && msg.targetId === privateChatWith) ||
            (msg.senderId === privateChatWith && msg.targetId === userId);
    }).sort((a: ChatMessage, b: ChatMessage) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ), [messages, privateChatWith, userId, guildChatActive, guildId]);

    const openPrivateTabsArray = useMemo(() =>
        Array.from(openPrivateTabs.entries()).map(([id, name]) => ({ id, name })),
        [openPrivateTabs]);

    return (
        <div
            ref={panelRef}
            className={`chat-panel fixed bottom-0 left-0 w-full flex-col z-[1000] transition-[height] duration-300 bg-[rgba(30,30,48,0.85)] backdrop-blur-[12px] border-t-2 border-[#555] ${visible ? 'flex' : 'hidden'} ${isPanelOpen ? 'h-[min(300px,50vh)]' : 'h-10'}`}
        >
            <div
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="cursor-pointer p-2 bg-[rgba(42,42,62,0.9)] border-b border-[#444] flex justify-between items-center"
            >
                <div className="flex items-center gap-1.5">
                    <Icon icon="game-icons:chat-bubble" width="18" height="18" className="inline" />
                    Чат ({onlineUsers.length})
                    {!isPanelOpen && (
                        <>
                            {unreadGeneral > 0 && (
                                <span className="chat-blink w-2.5 h-2.5 rounded-full bg-white inline-block" />
                            )}
                            {unreadGuild > 0 && (
                                <span className="chat-blink w-2.5 h-2.5 rounded-full bg-[#2ecc71] inline-block" />
                            )}
                            {Array.from(unreadPrivate.entries()).filter(([,c]) => c > 0).length > 0 && (
                                <span className="chat-blink w-2.5 h-2.5 rounded-full bg-[#c084fc] inline-block" />
                            )}
                        </>
                    )}
                </div>
                <span>{isPanelOpen ? '▼' : '▲'}</span>
            </div>

            {isPanelOpen && (
                <div className="flex-1 flex min-h-0">
                    <div className="flex-1 flex flex-col min-w-0">
                        <ChatTabs
                            privateChatWith={privateChatWith}
                            openPrivateTabs={openPrivateTabsArray}
                            guildChatActive={guildChatActive}
                            guildName={guildName || undefined}
                            unreadGeneral={unreadGeneral}
                            unreadPrivate={unreadPrivate}
                            unreadGuild={unreadGuild}
                            onSelectPublic={() => { setPrivateChatWith(null); setGuildChatActive(false); setUnreadGeneral(0); }}
                            onSelectPrivate={(id) => { setPrivateChatWith(id); setGuildChatActive(false); setUnreadPrivate(prev => { const n = new Map(prev); n.delete(id); return n; }); }}
                            onSelectGuild={() => { setPrivateChatWith(null); setGuildChatActive(true); setUnreadGuild(0); }}
                            onCloseTab={(e, id) => {
                                e.stopPropagation();
                                removeTab(id);
                                if (privateChatWith === id) setPrivateChatWith(null);
                            }}
                        />

                        <div className="py-[0.3rem] px-2 bg-[#2a2a3e] shrink-0">
                            {guildChatActive && guildName
                                ? <span className="text-[#2ecc71]">🏚️ Гильдия «{guildName}»</span>
                                : privateChatWith !== null
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
                            isGuild={guildChatActive}
                            onlineUsers={onlineUsers}
                            currentUserId={userId}
                            onSend={handleSend}
                            bannedUntil={bannedUntil}
                            chatError={chatError}
                            pendingMention={pendingMention}
                            isGuest={user?.isGuest}
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
