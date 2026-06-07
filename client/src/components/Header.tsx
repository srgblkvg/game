import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useServerTime } from '../contexts/ServerTimeContext';
import { fetchBattles, fetchCharacter } from '../api';
import Button from './ui/Button';

const breadcrumbMap: Record<string, string> = {
    arena: 'Арена',
    bestiary: 'Охота',
    tavern: 'Трактир',
    shop: 'Магазин',
    bank: 'Банк',
    craft: 'Крафт',
    auction: 'Аукцион',
    jobs: 'Работы',
    history: 'Сводка',
    rating: 'Рейтинг',
    profile: 'Профиль',
    tournament: 'Турниры',
    account: 'Аккаунт',
    adminpanel: 'Админ-панель',
    premium: 'Премиум',
    orders: 'Заказы',
    guild: 'Гильдия',
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
                            <span className={`font-semibold px-1.5 py-0.5 rounded ${isHome ? 'text-white' : 'text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'}`}>
                                {item.label}
                            </span>
                        ) : (
                            <button
                                onClick={() => navigate(item.path)}
                                className="text-[var(--color-accent-info)] hover:text-white hover:underline transition-colors px-1 cursor-pointer"
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
    const navigate = useNavigate();
    const location = useLocation();
    const [hasNewBattles, setHasNewBattles] = useState(false);
    const [protectionSec, setProtectionSec] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Закрытие меню по клику вне
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
                        const lastBattleTime = new Date(battles[0].createdAt + 'Z').getTime();
                        if (lastBattleTime > lastSeen) {
                            setHasNewBattles(true);
                        }
                    }
                })
                .catch(console.error);
        };

        checkForNewBattles();
        fetchCharacter().then(setCharacter).catch(console.error);
        const interval = setInterval(() => {
            checkForNewBattles();
            fetchCharacter().then(setCharacter).catch(console.error);
        }, 10000);

        return () => clearInterval(interval);
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

    const handleHistoryClick = () => {
        localStorage.setItem('lastHistorySeen', Date.now().toString());
        setHasNewBattles(false);
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
        <div className="sticky top-0 z-40 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
            <div className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
                {user.role === 'player' && character && (
                    <span className="text-white text-sm font-bold">
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
                    {user.role === 'player' && (
                        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                            {new Date(serverNow * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                        </span>
                    )}
                    {user.role === 'player' && (
                        <div ref={menuRef} className="relative">
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--color-bg-hover)] transition-colors relative cursor-pointer"
                                title="Настройки"
                            >
                                <Icon icon="mdi:cog" width="20" height="20" className="text-[var(--color-text-muted)]" />
                                {hasNewBattles && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-[var(--color-bg-secondary)] blink" />
                                )}
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg shadow-xl z-50 py-1">
                                    <button
                                        onClick={handleAccountClick}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        <Icon icon="game-icons:person" width="16" height="16" />
                                        Аккаунт
                                    </button>
                                    <button
                                        onClick={handleHistoryClick}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] flex items-center gap-2 text-[var(--color-text-primary)] cursor-pointer"
                                    >
                                        {hasNewBattles && <Icon icon="game-icons:bell" width="16" height="16" className="text-red-400" />}
                                        <Icon icon="game-icons:notebook" width="16" height="16" />
                                        Сводка
                                        {hasNewBattles && <span className="ml-auto text-red-400">●</span>}
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
                                </div>
                            )}
                        </div>
                    )}
                    {user.role === 'admin' && (
                        <Button variant="danger" size="sm" onClick={() => navigate('/adminpanel')}>
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
