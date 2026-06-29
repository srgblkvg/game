import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { formatMoney } from '../utils/money';
import Button from './ui/Button';
import { getHeaders } from '../api/helpers';

interface ActionsProps {
    canAttack: boolean;
    attackCooldownSec: number;
    pveCooldownSec: number;
    bankCooldownSec: number;
    onArenaClick: () => void;
    hasActiveJob?: boolean;
}

interface ActionCard {
    id: number;
    icon: string; title: string; subtitle: string; cost: number;
    path: string | null; bg_image: string | null; section: string;
    buttonText: string;
}

export default function Actions({ canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, hasActiveJob }: ActionsProps) {
    const navigate = useNavigate();
    const [cards, setCards] = useState<ActionCard[]>([]);
    const [auctionBadge, setAuctionBadge] = useState(parseInt(localStorage.getItem('auctionBadge') || '0'));
    const [guildBadge, setGuildBadge] = useState(parseInt(localStorage.getItem('guildBadge') || '0'));
    const [bankBadge, setBankBadge] = useState(parseInt(localStorage.getItem('bankBadge') || '0'));
    const [treasury, setTreasury] = useState(0);

    useEffect(() => {
        fetch('/api/treasury').then(r => r.json()).then(d => setTreasury(d.amount)).catch(() => {});
    }, []);

    // Бейдж аукциона через localStorage + событие
    useEffect(() => {
        const check = () => {
            const val = parseInt(localStorage.getItem('auctionBadge') || '0');
            if (val !== auctionBadge) setAuctionBadge(val);
        };
        check();
        const handler = () => check();
        window.addEventListener('auctionBadge', handler);
        return () => window.removeEventListener('auctionBadge', handler);
    }, [auctionBadge]);

    // Бейдж гильдии
    useEffect(() => {
        const check = () => {
            const val = parseInt(localStorage.getItem('guildBadge') || '0');
            if (val !== guildBadge) setGuildBadge(val);
        };
        check();
        const handler = () => check();
        window.addEventListener('guildBadge', handler);
        return () => window.removeEventListener('guildBadge', handler);
    }, [guildBadge]);

    // Бейдж банка
    useEffect(() => {
        const check = () => {
            const val = parseInt(localStorage.getItem('bankBadge') || '0');
            if (val !== bankBadge) setBankBadge(val);
        };
        check();
        const handler = () => check();
        window.addEventListener('bankBadge', handler);
        return () => window.removeEventListener('bankBadge', handler);
    }, [bankBadge]);

    useEffect(() => {
        fetch('/api/actions', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any[]) => {
                const mapped: ActionCard[] = (data || []).map(a => ({
                    ...a,
                    buttonText: a.cost > 0 ? `В бой` : 'Перейти',
                }));
                setCards(mapped);
            })
            .catch(() => {});
    }, []);

    const worldCards = cards.filter(c => c.section === 'world');
    const castleCards = cards.filter(c => c.section === 'castle');

    return (
        <div className="mt-6 w-full max-w-2xl mx-auto space-y-4">
            {worldCards.length > 0 && (
                <div>
                    <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Icon icon="game-icons:castle-ruins" width="14" height="14" />🌍 МИР
                    </h2>
                    <CardGrid cards={worldCards} canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} navigate={navigate} hasActiveJob={hasActiveJob} auctionBadge={auctionBadge} guildBadge={guildBadge} bankBadge={bankBadge} onAuctionClick={() => { localStorage.setItem('auctionBadge', '0'); setAuctionBadge(0); }} onGuildClick={() => { localStorage.setItem('guildBadgeSeen', String(guildBadge)); localStorage.setItem('guildBadge', '0'); setGuildBadge(0); }} onBankClick={() => { localStorage.setItem('bankBadge', '0'); setBankBadge(0); }} />
                </div>
            )}
            {castleCards.length > 0 && (
                <div className="border-t border-[var(--color-border-light)] pt-4">
                    <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Icon icon="game-icons:castle" width="14" height="14" />🏰 Площадь
                    </h2>
                    <CardGrid cards={castleCards} canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} navigate={navigate} hasActiveJob={hasActiveJob} auctionBadge={auctionBadge} guildBadge={guildBadge} bankBadge={bankBadge} onAuctionClick={() => { localStorage.setItem('auctionBadge', '0'); setAuctionBadge(0); }} onGuildClick={() => { localStorage.setItem('guildBadgeSeen', String(guildBadge)); localStorage.setItem('guildBadge', '0'); setGuildBadge(0); }} onBankClick={() => { localStorage.setItem('bankBadge', '0'); setBankBadge(0); }} />
                </div>
            )}
        </div>
    );
}

function CardGrid({ cards, canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, navigate, hasActiveJob, auctionBadge, guildBadge, bankBadge, onAuctionClick, onGuildClick, onBankClick }: {
    cards: ActionCard[]; canAttack: boolean; attackCooldownSec: number; pveCooldownSec: number; bankCooldownSec: number;
    navigate: (path: string) => void; hasActiveJob?: boolean; auctionBadge?: number; guildBadge?: number; bankBadge?: number; onAuctionClick?: () => void; onGuildClick?: () => void; onBankClick?: () => void;
}) {
    const [arenaDifficulty, setArenaDifficulty] = useState<string>('equal');
    const [highlightedCard, setHighlightedCard] = useState<string | null>(null);

    useEffect(() => {
        const update = () => {
            const h = window.location.hash;
            if (h.startsWith('#action-')) setHighlightedCard(h.replace('#action-', ''));
            else setHighlightedCard(null);
        };
        update();
        window.addEventListener('hashchange', update);
        return () => window.removeEventListener('hashchange', update);
    }, []);

    const questToCard: Record<string, string> = { hunt: 'Охота', arena: 'Арена', job: 'Работы', craft: 'Ремесло', auction: 'Аукцион' };
    const highlightCard = highlightedCard ? questToCard[highlightedCard] : null;

    useEffect(() => {
        if (!highlightCard) return;
        setTimeout(() => {
            if (window.innerWidth < 640) {
                const el = document.getElementById(`action-card-${highlightCard}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
        const timer = setTimeout(() => { setHighlightedCard(null); history.replaceState(null, '', window.location.pathname + window.location.search); }, 3000);
        return () => clearTimeout(timer);
    }, [highlightCard]);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cards.map((card, i) => {
                const isArena = card.path === null || card.title === 'Арена';
                const isHunt = card.path === '/bestiary' || card.title === 'Охота';
                const isBank = card.path === '/bank' || card.title === 'Банк';
                const huntDisabled = isHunt && (pveCooldownSec > 0 || hasActiveJob);
                const arenaDisabled = isArena && (!canAttack || hasActiveJob);
                const bankDisabled = isBank && bankCooldownSec > 0;
                const disabled = arenaDisabled || huntDisabled || bankDisabled;
                const cdSec = isArena ? attackCooldownSec : isHunt ? pveCooldownSec : isBank ? bankCooldownSec : 0;
                const btnText = disabled && cdSec > 0
                    ? `${Math.floor(cdSec / 60)}:${String(cdSec % 60).padStart(2, '0')}`
                    : hasActiveJob && (isHunt || isArena) ? 'Работа...' : card.buttonText;

                const highlighted = highlightCard === card.title;

                // Замок — full-width card with button on the side
                if (card.title === 'Замок') {
                    const bgStyle = card.bg_image ? { backgroundImage: `url(${card.bg_image})` } : {};
                    return (
                        <div key={i} className="col-span-full relative group" id={`action-card-${card.title}`}>
                            <div className={`relative bg-[var(--color-bg-secondary)] rounded-xl p-3 border flex flex-row items-center gap-3 overflow-hidden transition-all ${highlighted ? 'border-[var(--color-accent-info)] ring-2 ring-[var(--color-accent-info)]' : 'border-[var(--color-border-default)]'}`}>
                                <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
                                <div className="relative flex-1 min-w-0">
                                    <h3 className="text-[0.85rem] font-bold flex items-center gap-1">
                                        <Icon icon={card.icon} width="14" height="14" />{card.title}
                                    </h3>
                                    <p className="text-[0.7rem] text-[var(--color-text-muted)]">{card.subtitle}</p>
                                    {treasury > 0 && <p className="text-[0.65rem] text-[var(--color-accent-warning)] mt-0.5">Казна: {formatMoney(treasury)}</p>}
                                </div>
                                <div className="relative shrink-0">
                                    <Button variant="danger" size="xs" onClick={() => { if (card.path) navigate(card.path); }}>Перейти</Button>
                                </div>
                            </div>
                        </div>
                    );
                }

                if (isArena) {
                    return <ArenaFlipCard key={i} card={card} disabled={disabled} cdSec={cdSec} btnText={btnText}
                        arenaDifficulty={arenaDifficulty} setArenaDifficulty={setArenaDifficulty} navigate={navigate}
                        highlighted={highlighted} />;
                }

                const bgStyle = card.bg_image
                    ? { backgroundImage: `url(${card.bg_image})` }
                    : {};

                return (
                    <div key={i} className="relative group" id={`action-card-${card.title}`}>
                        <div className={`relative bg-[var(--color-bg-secondary)] rounded-xl p-3 border flex flex-col items-center text-center overflow-hidden transition-all ${highlighted ? 'border-[var(--color-accent-info)] ring-2 ring-[var(--color-accent-info)]' : 'border-[var(--color-border-default)]'}`}>
                        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
                        <div className="relative w-full flex flex-col flex-1">
                            <h3 className="text-[0.85rem] font-bold mb-0.5 flex items-center justify-center gap-1">
                                <Icon icon={card.icon} width="14" height="14" />{card.title}
                            </h3>
                            <p className="text-[0.7rem] text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                            <div className="mt-auto">
                                {card.cost > 0 && <p className="text-[0.6rem] text-[var(--color-text-muted)]">Цена: {formatMoney(card.cost)}</p>}
                                <Button variant={disabled ? 'secondary' : 'danger'} size="xs" fullWidth disabled={disabled}
                                    onClick={() => { if (card.path) { if (card.title === 'Аукцион' && onAuctionClick) onAuctionClick(); if (card.title === 'Гильдия' && onGuildClick) onGuildClick(); if (card.title === 'Банк' && onBankClick) onBankClick(); navigate(card.path); } }}>
                                    {disabled && cdSec > 0 ? <span className="flex items-center justify-center gap-1"><Icon icon="game-icons:hourglass" width="12" height="12" />{btnText}</span> : btnText}
                                </Button>
                            </div>
                        </div>
                    </div>
                    {card.title === 'Аукцион' && (auctionBadge ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[0.55rem] font-bold flex items-center justify-center px-1 shadow">
                            {auctionBadge ?? 0}
                        </span>
                    )}
                    {card.title === 'Гильдия' && (guildBadge ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[0.55rem] font-bold flex items-center justify-center px-1 shadow">
                            {guildBadge ?? 0}
                        </span>
                    )}
                    {card.title === 'Банк' && (bankBadge ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[0.55rem] font-bold flex items-center justify-center px-1 shadow">
                            {bankBadge ?? 0}
                        </span>
                    )}
                    </div>
                );
            })}
        </div>
    );
}

function ArenaFlipCard({ card, disabled, cdSec, btnText, arenaDifficulty, setArenaDifficulty, navigate, highlighted }: {
    card: ActionCard; disabled: boolean; cdSec: number; btnText: string;
    arenaDifficulty: string; setArenaDifficulty: (d: string) => void; navigate: (path: string) => void;
    highlighted?: boolean;
}) {
    const [flipped, setFlipped] = useState(false);
    const [modalMsg, setModalMsg] = useState('');

    useEffect(() => {
        if (!modalMsg) return;
        const t = setTimeout(() => setModalMsg(''), 2000);
        return () => clearTimeout(t);
    }, [modalMsg]);

    const handleSearch = async () => {
        setModalMsg('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/arena/opponent?change=false&difficulty=${arenaDifficulty}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (!res.ok) {
                setModalMsg(data.error || 'Нет соперников');
            } else {
                navigate(`/arena?difficulty=${arenaDifficulty}`);
            }
        } catch {
            setModalMsg('Ошибка сети');
        }
    };

    const bgStyle = card.bg_image ? { backgroundImage: `url(${card.bg_image})` } : {};

    return (
        <>
        <div className="perspective-600">
            <div className={`relative w-full transition-transform duration-400 [transform-style:preserve-3d] ${flipped ? 'rotate-y-180' : ''}`} id={`action-card-${card.title}`}>
                <div className={`relative bg-[var(--color-bg-secondary)] rounded-xl p-3 border flex flex-col items-center text-center overflow-hidden transition-all backface-hidden ${flipped ? 'pointer-events-none' : ''} ${highlighted ? 'border-[var(--color-accent-info)] ring-2 ring-[var(--color-accent-info)]' : 'border-[var(--color-border-default)]'}`}>
                <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
                <div className="relative w-full flex flex-col flex-1">
                    <h3 className="text-[0.85rem] font-bold mb-0.5 flex items-center justify-center gap-1">
                        <Icon icon={card.icon} width="14" height="14" />{card.title}
                    </h3>
                    <p className="text-[0.7rem] text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                        <div className="mt-auto">
                            <Button variant={disabled ? 'secondary' : 'danger'} size="xs" fullWidth disabled={disabled}
                                onClick={() => { if (!disabled) setFlipped(true); }}>
                                {disabled && cdSec > 0 ? <span className="flex items-center justify-center gap-1"><Icon icon="game-icons:hourglass" width="12" height="12" />{btnText}</span> : btnText}
                            </Button>
                        </div>
                    </div>
                </div>
                <div className={`absolute inset-0 bg-[var(--color-bg-secondary)] rounded-xl p-3 border border-[var(--color-border-default)] flex flex-col items-center justify-center gap-2 backface-hidden [transform:rotateY(180deg)] ${!flipped ? 'pointer-events-none' : ''}`}>
                    <p className="text-[0.65rem] text-[var(--color-text-muted)]">Сложность соперника:</p>
                    <select value={arenaDifficulty} onChange={e => setArenaDifficulty(e.target.value)}
                        className="bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] rounded px-2 py-1 text-xs w-full">
                        <option value="easy">Лёгкий (ниже ур.)</option>
                        <option value="equal">Равный</option>
                        <option value="hard">Сложный (выше ур.)</option>
                    </select>
                    <div className="flex gap-1 w-full">
                        <Button variant="danger" size="xs" fullWidth onClick={handleSearch}>Поиск</Button>
                        <Button variant="secondary" size="xs" onClick={() => { setFlipped(false); }} className="min-w-[24px]">←</Button>
                    </div>
                </div>
            </div>
        </div>
        {modalMsg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-[var(--color-accent-danger)]/20 text-white border border-[var(--color-accent-danger)]/40 rounded-lg px-6 py-3 shadow-2xl text-sm font-medium animate-pulse">
                    {modalMsg}
                </div>
            </div>
        )}
        </>
    );
}
