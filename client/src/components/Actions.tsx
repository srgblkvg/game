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
    const [tournamentInfo, setTournamentInfo] = useState<any>(null);
    const [myRegistration, setMyRegistration] = useState<any>(null);
    const [registerMsg, setRegisterMsg] = useState('');
    const [nextTournamentSec, setNextTournamentSec] = useState(0);
    const [nextTournamentLabel, setNextTournamentLabel] = useState('');
    const [auctionBadge, setAuctionBadge] = useState(parseInt(localStorage.getItem('auctionBadge') || '0'));
    const [guildBadge, setGuildBadge] = useState(parseInt(localStorage.getItem('guildBadge') || '0'));
    const [bankBadge, setBankBadge] = useState(parseInt(localStorage.getItem('bankBadge') || '0'));
    const [treasury, setTreasury] = useState(0);
    const [massacreCount, setMassacreCount] = useState(0);
    const [massacreTimeLeft, setMassacreTimeLeft] = useState(0);

    useEffect(() => {
        fetch('/api/treasury').then(r => r.json()).then(d => setTreasury(d.amount)).catch(() => {});
    }, []);

    // Счётчик и таймер резни — через WS
    useEffect(() => {
        const handler = (e: Event) => {
            const { participant_count, timeLeft } = (e as CustomEvent).detail;
            setMassacreCount(participant_count || 0);
            setMassacreTimeLeft(timeLeft || 0);
        };
        window.addEventListener('massacreTick', handler);
        // Первичная загрузка
        fetch('/api/massacre/state', { headers: getHeaders() })
            .then(r => r.json())
            .then(d => {
                if (d.event) {
                    setMassacreCount(d.event.participant_count || 0);
                    setMassacreTimeLeft(d.timeLeft || 0);
                }
            })
            .catch(() => {});
        return () => window.removeEventListener('massacreTick', handler);
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
        // Турниры для Замка
        fetch('/api/tournament?tab=active&type=official', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any) => {
                if (data.tournaments?.length > 0) {
                    const t = data.tournaments[0];
                    setTournamentInfo(t);
                    setMyRegistration(t.myRegistration || null);
                    setNextTournamentSec(0);
                } else if (data.upcomingOfficial?.length > 0) {
                    // Находим ближайший подходящий по уровню
                    const myLevel = data.userLevel || 1;
                    const suitable = data.upcomingOfficial
                        .filter((u: any) => myLevel >= u.minLevel && myLevel <= u.maxLevel)
                        .sort((a: any, b: any) => a.registrationOpensAt - b.registrationOpensAt);
                    if (suitable.length > 0) {
                        const next = suitable[0];
                        const now = Math.floor(Date.now() / 1000);
                        setNextTournamentSec(Math.max(0, next.registrationOpensAt - now));
                        setNextTournamentLabel(`${next.icon || '🏆'} ${next.label || next.division}`);
                    }
                }
            })
            .catch(() => {});
    }, []);

    // Таймер до следующего турнира
    useEffect(() => {
        if (nextTournamentSec <= 0) return;
        const id = setInterval(() => {
            setNextTournamentSec(prev => {
                if (prev <= 1) { setTournamentInfo(null); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [nextTournamentSec > 0 ? 1 : 0]);

    // Туториал: переключение табов
    useEffect(() => {
        const toWorld = () => setActiveTab('world');
        const toCastle = () => setActiveTab('castle');
        window.addEventListener('tutorial-tab-world', toWorld);
        window.addEventListener('tutorial-tab-castle', toCastle);
        return () => {
            window.removeEventListener('tutorial-tab-world', toWorld);
            window.removeEventListener('tutorial-tab-castle', toCastle);
        };
    }, []);

    const heroCards = cards.filter(c => c.section === 'hero');
    const worldCards = cards.filter(c => c.section === 'world');
    const castleCards = cards.filter(c => c.section === 'castle');
    const [activeTab, setActiveTab] = useState<'world' | 'castle'>('world');

    const activeCards = activeTab === 'world' ? worldCards : castleCards;

    return (
        <div className="mt-6 w-full max-w-2xl mx-auto space-y-4" data-tutorial="actions">
            {heroCards.length > 0 && (
                <div>
                    <CardGrid cards={heroCards} canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} navigate={navigate} hasActiveJob={hasActiveJob} auctionBadge={auctionBadge} guildBadge={guildBadge} bankBadge={bankBadge} treasury={treasury} massacreCount={0} massacreTimeLeft={0} onAuctionClick={() => { localStorage.setItem('auctionBadge', '0'); setAuctionBadge(0); }} onGuildClick={() => { localStorage.setItem('guildBadgeSeen', String(guildBadge)); localStorage.setItem('guildBadge', '0'); setGuildBadge(0); }} onBankClick={() => { localStorage.setItem('bankBadge', '0'); setBankBadge(0); }} tournamentInfo={tournamentInfo} myRegistration={myRegistration} registerMsg={registerMsg} setRegisterMsg={setRegisterMsg} nextTournamentSec={nextTournamentSec} nextTournamentLabel={nextTournamentLabel} />
                </div>
            )}
            {/* Категории */}
            <div className="flex justify-center gap-2" data-tutorial="actions-tabs">
                <button
                    onClick={() => setActiveTab('world')}
                    className={`cursor-pointer px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'world' ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'}`}
                >🌍 Мир</button>
                <button
                    onClick={() => setActiveTab('castle')}
                    className={`cursor-pointer px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'castle' ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'}`}
                >🏰 Площадь</button>
            </div>
            <CardGrid cards={activeCards} canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} navigate={navigate} hasActiveJob={hasActiveJob} auctionBadge={auctionBadge} guildBadge={guildBadge} bankBadge={bankBadge} treasury={treasury} massacreCount={activeTab === 'world' ? massacreCount : 0} massacreTimeLeft={activeTab === 'world' ? massacreTimeLeft : 0} onAuctionClick={() => { localStorage.setItem('auctionBadge', '0'); setAuctionBadge(0); }} onGuildClick={() => { localStorage.setItem('guildBadgeSeen', String(guildBadge)); localStorage.setItem('guildBadge', '0'); setGuildBadge(0); }} onBankClick={() => { localStorage.setItem('bankBadge', '0'); setBankBadge(0); }} tournamentInfo={activeTab === 'world' ? null : tournamentInfo} myRegistration={activeTab === 'world' ? null : myRegistration} registerMsg={registerMsg} setRegisterMsg={setRegisterMsg} nextTournamentSec={activeTab === 'world' ? 0 : nextTournamentSec} />
        </div>
    );
}

function CardGrid({ cards, canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, navigate, hasActiveJob, auctionBadge, guildBadge, bankBadge, treasury, massacreCount, massacreTimeLeft, onAuctionClick, onGuildClick, onBankClick, tournamentInfo, myRegistration, registerMsg, setRegisterMsg, nextTournamentSec, nextTournamentLabel }: {
    cards: ActionCard[]; canAttack: boolean; attackCooldownSec: number; pveCooldownSec: number; bankCooldownSec: number;
    navigate: (path: string) => void; hasActiveJob?: boolean; auctionBadge?: number; guildBadge?: number; bankBadge?: number; treasury: number; massacreCount: number; massacreTimeLeft: number; onAuctionClick?: () => void; onGuildClick?: () => void; onBankClick?: () => void;
    tournamentInfo?: any; myRegistration?: any; registerMsg?: string; setRegisterMsg?: (msg: string) => void; nextTournamentSec?: number; nextTournamentLabel?: string;
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
                                    <h3 className="text-base font-bold flex items-center gap-1">
                                        <Icon icon={card.icon} width="14" height="14" />{card.title}
                                    </h3>
                                    <p className="text-xs text-[var(--color-text-muted)]">{card.subtitle}</p>
                                    <p className="text-xs text-[var(--color-accent-warning)] mt-0.5">Казна: {formatMoney(treasury)}</p>
                                    {tournamentInfo ? (
                                        <div className="mt-1 text-xs">
                                            {tournamentInfo.status === 'registration' ? (
                                                myRegistration ? (
                                                    <span className="text-[var(--color-accent-success)]">✓ Вы записаны</span>
                                                ) : (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                const res = await fetch('/api/tournament/register', {
                                                                    method: 'POST',
                                                                    headers: getHeaders(),
                                                                    body: JSON.stringify({ tournamentId: tournamentInfo.id }),
                                                                });
                                                                const d = await res.json();
                                                                if (d.success) setRegisterMsg?.('Записаны!');
                                                                else setRegisterMsg?.(d.error || 'Ошибка');
                                                            } catch { setRegisterMsg?.('Ошибка'); }
                                                        }}
                                                        className="text-[var(--color-accent-info)] underline cursor-pointer hover:text-[var(--color-accent-warning)]"
                                                    >Записаться</button>
                                                )
                                            ) : null}
                                            <span className="text-[var(--color-text-muted)] ml-1">
                                                {tournamentInfo.division && `🏆 ${tournamentInfo.division}`}
                                            </span>
                                        </div>
                                    ) : nextTournamentSec && nextTournamentSec > 0 ? (
                                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                                            ⏳ Следующий турнир: {nextTournamentLabel} через {String(Math.floor(nextTournamentSec / 3600)).padStart(2, '0')}:{String(Math.floor((nextTournamentSec % 3600) / 60)).padStart(2, '0')}:{String(nextTournamentSec % 60).padStart(2, '0')}
                                        </div>
                                    ) : null}
                                    {registerMsg && <p className="text-xs text-[var(--color-accent-success)] mt-0.5">{registerMsg}</p>}
                                </div>
                                <div className="relative shrink-0">
                                    <Button variant="danger" size="md" onClick={() => { if (card.path) navigate(card.path); }}>Перейти</Button>
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

                const isMassacre = card.path === '/massacre';

                if (isMassacre) {
                    const bgStyle = card.bg_image ? { backgroundImage: `url(${card.bg_image})` } : {};
                    const formatTime = (sec: number) => {
                        const m = Math.floor(sec / 60);
                        const s = sec % 60;
                        return `${m}:${s.toString().padStart(2, '0')}`;
                    };
                    return (
                        <div key={i} className="relative group" id={`action-card-${card.title}`}>
                            <div className={`relative bg-[var(--color-bg-secondary)] rounded-xl p-3 border flex flex-col items-center text-center overflow-hidden transition-all ${highlighted ? 'border-[var(--color-accent-info)] ring-2 ring-[var(--color-accent-info)]' : 'border-[var(--color-border-default)]'}`}>
                                <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
                                <div className="relative w-full flex flex-col flex-1">
                                    <h3 className="text-base font-bold mb-0.5 flex items-center justify-center gap-1">
                                        <Icon icon={card.icon} width="14" height="14" />{card.title}
                                    </h3>
                                    <p className="text-sm text-[var(--color-text-muted)] mb-1">
                                        Хаотичный PvP{massacreCount > 0 && <span className="text-[var(--color-accent-danger)]"> · {massacreCount} уч.</span>}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] h-4 leading-4">Вход: {formatMoney(card.cost)}</p>
                                    <div className="mt-auto">
                                        <Button variant="danger" size="md" fullWidth
                                            onClick={() => { if (card.path) navigate(card.path); }}>
                                            {massacreTimeLeft > 0 ? formatTime(massacreTimeLeft) : 'В бой'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }

                const bgStyle = card.bg_image
                    ? { backgroundImage: `url(${card.bg_image})` }
                    : {};

                return (
                    <div key={i} className="relative group" id={`action-card-${card.title}`}>
                        <div className={`relative bg-[var(--color-bg-secondary)] rounded-xl p-3 border flex flex-col items-center text-center overflow-hidden transition-all ${highlighted ? 'border-[var(--color-accent-info)] ring-2 ring-[var(--color-accent-info)]' : 'border-[var(--color-border-default)]'}`}>
                        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
                        <div className="relative w-full flex flex-col flex-1">
                            <h3 className="text-base font-bold mb-0.5 flex items-center justify-center gap-1">
                                <Icon icon={card.icon} width="14" height="14" />{card.title}
                            </h3>
                            <p className="text-sm text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                            <div className="mt-auto">
                                <p className="text-xs text-[var(--color-text-muted)] h-4 leading-4">{card.cost > 0 ? `${card.path === '/massacre' ? 'Вход' : 'Цена'}: ${formatMoney(card.cost)}` : ''}</p>
                                <Button variant={disabled ? 'secondary' : 'danger'} size="md" fullWidth disabled={disabled}
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
                    <h3 className="text-base font-bold mb-0.5 flex items-center justify-center gap-1">
                        <Icon icon={card.icon} width="14" height="14" />{card.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                    <p className="text-xs text-[var(--color-text-muted)] h-4 leading-4">{card.cost > 0 ? `Цена: ${formatMoney(card.cost)}` : ''}</p>
                        <div className="mt-auto">
                            <Button variant={disabled ? 'secondary' : 'danger'} size="md" fullWidth disabled={disabled}
                                onClick={() => { if (!disabled) setFlipped(true); }}>
                                {disabled && cdSec > 0 ? <span className="flex items-center justify-center gap-1"><Icon icon="game-icons:hourglass" width="12" height="12" />{btnText}</span> : btnText}
                            </Button>
                        </div>
                    </div>
                </div>
                <div className={`absolute inset-0 bg-[var(--color-bg-secondary)] rounded-xl p-3 border border-[var(--color-border-default)] flex flex-col items-center justify-center gap-2 backface-hidden [transform:rotateY(180deg)] ${!flipped ? 'pointer-events-none' : ''}`}>
                    <p className="text-xs text-[var(--color-text-muted)]">Сложность соперника:</p>
                    <select value={arenaDifficulty} onChange={e => setArenaDifficulty(e.target.value)}
                        className="bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] rounded px-2 py-1 text-xs w-full">
                        <option value="easy">Слабый</option>
                        <option value="equal">Равный</option>
                        <option value="hard">Сильный</option>
                    </select>
                    <div className="flex gap-1 w-full">
                        <Button variant="danger" size="md" fullWidth onClick={handleSearch}>Поиск</Button>
                        <Button variant="secondary" size="md" onClick={() => { setFlipped(false); }} className="min-w-[24px]">←</Button>
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
