import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useServerTime } from '../contexts/ServerTimeContext';
import { useGlobalChat } from '../contexts/ChatContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchBattles, fetchCharacter } from '../api';
import { safeDate } from '../utils/date';
import { formatGameTime } from '../utils/time';
import Button from './ui/Button';

const breadcrumbMap: Record<string, string> = {
    arena: 'Арена',
    bestiary: 'Охота',
    tavern: 'Трактир',
    shop: 'Магазин',
    bank: 'Банк',
    craft: 'Ремесло',
    auction: 'Аукцион',
    jobs: 'Работы',
    history: 'Сводка',
    rating: 'Рейтинг',
    profile: 'Профиль',
    tournament: 'Турниры',
    account: 'Аккаунт',
    adminpanel: 'Админ-панель',
    premium: 'Премиум',
    guild: 'Гильдия',
    war: 'Поле боя',
    massacre: 'Резня',
    feedback: 'Обратная связь',
    collections: 'Коллекция',
    castle: 'Замок',
    forum: 'Форум',
    wiki: 'Руководство',
};

function Breadcrumbs({ pathname, navigate }: { pathname: string; navigate: (p: string) => void }) {
    const segments = pathname.split('/').filter(Boolean);
    const items = [{ label: 'Персонаж', path: '/' }];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (/^\d+$/.test(seg)) continue;
        const label = breadcrumbMap[seg] || seg;
        const path = '/' + segments.slice(0, i + 1).join('/');
        items.push({ label, path });
    }
    const isHome = items.length === 1;
    return (
        <div className="px-3 py-1.5 bg-[var(--color-bg-primary)] border-t border-[var(--color-border-light)]">
            <div className="flex items-center justify-center gap-1.5 text-xs overflow-x-auto whitespace-nowrap max-w-max mx-auto">
            {items.map((item, i) => {
                const isLast = i === items.length - 1;
                return (
                    <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-[var(--color-text-muted)] select-none">›</span>}
                        {isLast ? (
                            <span className={`font-semibold px-1.5 py-0.5 rounded ${isHome ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'}`}>
                                {item.label}
                            </span>
                        ) : (
                            <button
                                onClick={() => navigate(item.path)}
                                className="text-[var(--color-accent-info)] hover:text-[var(--color-text-primary)] hover:underline transition-colors px-1 cursor-pointer"
                            >
                                {item.label}
                            </button>
                        )}
                    </span>
                );
            })}
        </div>
        </div>
    );
}

export default function Header() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const { now: serverNow } = useServerTime();
    const { messages } = useGlobalChat();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [hasNewBattles, setHasNewBattles] = useState(false);
    const [hasUnreadPM, setHasUnreadPM] = useState(false);
    const [protectionSec, setProtectionSec] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const isVK = typeof document !== 'undefined' && document.documentElement.classList.contains('vk-iframe');

    // Закрытие меню по клику вне
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current && !menuRef.current.contains(target) && popupRef.current && !popupRef.current.contains(target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    useEffect(() => {
        if (!user || user.role === 'admin') return;

        const checkForNewBattles = () => {
            const lastSeen = parseInt(localStorage.getItem('lastHistorySeen') || '0');
            fetchBattles(1)
                .then((battles: any[]) => {
                    if (battles.length > 0) {
                        // Показываем уведомление только если атаковали игрока (он defender)
                        const newDefeats = battles.filter((b: any) => b.defenderId === user.id);
                        if (newDefeats.length > 0) {
                            const lastBattleTime = safeDate(newDefeats[0].createdAt)?.getTime() ?? Date.now();
                            if (lastBattleTime > lastSeen) {
                                setHasNewBattles(true);
                            }
                        }
                    }
                })
                .catch(console.error);
        };

        checkForNewBattles();
        fetchCharacter().then(char => setCharacter({ ...char })).catch(console.error);
        const interval = setInterval(() => {
            checkForNewBattles();
            fetchCharacter().then(char => setCharacter(prev => ({ ...prev, ...char }))).catch(console.error);
        }, 30000);

        // Баланс через WS — мгновенное обновление money (кроме времени боя)
        const onBalance = (e: Event) => {
            if ((window as any).__battling) return;
            const { money } = (e as CustomEvent).detail;
            if (money !== undefined) {
                setCharacter((prev: any) => prev ? { ...prev, money } : prev);
            }
        };
        window.addEventListener('balance', onBalance);
        return () => {
            clearInterval(interval);
            window.removeEventListener('balance', onBalance);
        };
    }, [user, setCharacter]);

    useEffect(() => {
        if (!character || !user || user.role !== 'player') return;
        const update = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, (character.protectionUntil || 0) - now);
            setProtectionSec(remaining);
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [character, user]);

    // Отслеживание новых личных сообщений
    const userId = user?.id;
    useEffect(() => {
        if (!userId || messages.length === 0) return;
        const lastPMSeen = parseInt(localStorage.getItem('lastPMSeen') || '0');
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.targetId === userId && lastMsg.senderId !== userId) {
            const msgTime = new Date(lastMsg.createdAt).getTime();
            if (msgTime > lastPMSeen) {
                setHasUnreadPM(true);
            }
        }
    }, [messages.length, userId]);

    const handleHistoryClick = () => {
        localStorage.setItem('lastHistorySeen', Date.now().toString());
        localStorage.setItem('lastPMSeen', Date.now().toString());
        setHasNewBattles(false);
        setHasUnreadPM(false);
        setMenuOpen(false);
        navigate('/history');
    };

    const handleAccountClick = () => {
        setMenuOpen(false);
        navigate('/account');
    };

    if (!user) return null;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div id="site-header" className="sticky top-0 z-40 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
            {/* Имя и уровень слева, время по центру в VK-отступе */}
            {isVK && user.role === 'player' && character && (
                <div className="absolute top-0 left-3 flex items-center pointer-events-none"
                     style={{ height: 'var(--vk-top-offset, 0px)' }}>
                    <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">
                        {character.username} [{character.level}]
                    </span>
                </div>
            )}
            {isVK && user.role === 'player' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none"
                     style={{ height: 'var(--vk-top-offset, 0px)' }}>
                    <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                        {formatGameTime(serverNow * 1000)}
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
                {user.role === 'player' && character && (
                    <span className="text-[var(--color-text-primary)] text-sm font-bold">
                        Серебро: {character.money.toLocaleString()}
                    </span>
                )}
                {user.role === 'player' && (
                    protectionSec > 0 ? (
                        <span className="text-[var(--color-accent-info)] text-xs px-2 py-0.5 rounded-xl flex items-center gap-1 bg-[rgba(52,152,219,0.15)]">
                            <Icon icon="game-icons:shield" width="18" height="18" />
                            {formatTime(protectionSec)}
                        </span>
                    ) : (
                        <span className="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded-xl flex items-center gap-1 bg-[rgba(255,255,255,0.05)]">
                            <Icon icon="game-icons:shield-disabled" width="18" height="18" />
                            нет защиты
                        </span>
                    )
                )}
                <div className="flex gap-2 ml-auto items-center">
                    {!isVK && user.role === 'player' && (
                        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                            {formatGameTime(serverNow * 1000)}
                        </span>
                    )}
                    {user.role === 'player' && (
                        <button
                            onClick={handleHistoryClick}
                            className="inline-flex flex-col items-center justify-center rounded hover:bg-[var(--color-bg-hover)] transition-colors relative cursor-pointer px-1 py-0.5"
                            title="Сводка"
                        >
                            <Icon icon="game-icons:notebook" width="20" height="20" className="text-[var(--color-text-muted)]" />
                            <span className="text-[0.55rem] text-[var(--color-text-muted)] leading-none mt-0.5">Сводка</span>
                            {(hasNewBattles || hasUnreadPM) && (
                                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[var(--color-bg-secondary)] blink" />
                            )}
                        </button>
                    )}
                    {user.role === 'player' && (
                        <div ref={menuRef} className="relative">
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="inline-flex flex-col items-center justify-center rounded hover:bg-[var(--color-bg-hover)] transition-colors relative cursor-pointer px-1 py-0.5"
                                title="Настройки"
                            >
                                <Icon icon="game-icons:cog" width="20" height="20" className="text-[var(--color-text-muted)]" />
                                <span className="text-[0.55rem] text-[var(--color-text-muted)] leading-none mt-0.5">Настройки</span>
                                {(user.isGuest) && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[var(--color-accent-danger)] rounded-full animate-pulse" />
                                )}
                            </button>
                            {menuOpen && createPortal(
                                <div id="header-popup" ref={popupRef} className="fixed right-3 top-11 mt-1 w-44 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg shadow-xl z-[70] py-1">
                                    <button
                                        onClick={handleAccountClick}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon="game-icons:person" width="16" height="16" />
                                        Аккаунт
                                    </button>
                                    <button
                                        onClick={() => { toggleTheme(); setMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon={theme === 'dark' ? 'game-icons:sun' : 'game-icons:moon'} width="16" height="16" />
                                        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                                    </button>
                                    <button
                                        onClick={() => { navigate('/wiki'); setMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon="game-icons:open-book" width="16" height="16" className="text-[var(--color-accent-success)]" />
                                        Руководство
                                    </button>
                                    <button
                                        onClick={() => { navigate('/feedback'); setMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon="game-icons:envelope" width="16" height="16" className="text-[var(--color-accent-info)]" />
                                        Обратная связь
                                    </button>
                                    <a
                                        href="https://vk.com/club239320810"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] no-underline cursor-pointer"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <Icon icon="mdi:vk" width="16" height="16" className="text-[#0077FF]" />
                                        Сообщество VK
                                    </a>
                                    <button
                                        onClick={() => { navigate('/rules'); setMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon="game-icons:book-cover" width="16" height="16" className="text-[var(--color-text-muted)]" />
                                        Правила
                                    </button>
                                    <button
                                        onClick={() => { navigate('/privacy'); setMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon="game-icons:locked-door" width="16" height="16" className="text-[var(--color-text-muted)]" />
                                        Конфиденциальность
                                    </button>
                                    {(user.isGuest) && (
                                        <div className="border-t border-[var(--color-border-light)] mt-1 pt-1 px-3 py-1.5">
                                            <p className="text-[0.6rem] text-[var(--color-accent-gold)] mb-1">Привяжите аккаунт — 1 день премиума!</p>
                                            <div className="flex gap-1">
                                                <a href="/api/oauth/yandex" className="flex-1 text-center text-[0.55rem] px-1.5 py-0.5 rounded bg-[#FC3F1D] text-white no-underline">Яндекс</a>
                                                <a href="/api/oauth/vk" className="flex-1 text-center text-[0.55rem] px-1.5 py-0.5 rounded bg-[#0077FF] text-white no-underline">VK</a>
                                            </div>
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
                        </div>
                    )}
                    {user.role === 'admin' && (
                        <Button variant="danger" size="md" onClick={() => navigate('/adminpanel')}>
                            <span className="flex items-center gap-1">
                                <Icon icon="game-icons:shield" width="18" height="18" />
                                Панель администратора
                            </span>
                        </Button>
                    )}
                </div>
            </div>
            <Breadcrumbs pathname={location.pathname} navigate={navigate} />
        </div>
    );
}
