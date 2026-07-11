import { useState, useEffect, useRef } from 'react';
import Button from '../components/ui/Button';
import BackButton from '../components/BackButton';
import PageHeader from '../components/ui/PageHeader';
import { getHeaders } from '../api/helpers';
import { useToast } from '../contexts/ToastContext';
import { formatMoney } from '../utils/money';
import { inputClass } from '../utils/formStyles';

const isVK = typeof document !== 'undefined' && document.documentElement.classList.contains('vk-iframe');
const inputType = isVK ? 'text' : 'number';

// Анимации карт
const cardKeyframes = `
@keyframes card-deal {
  0% { transform: translate(80px, -60px) scale(0.3) rotate(-15deg); opacity: 0; }
  60% { transform: translate(10px, -5px) scale(1.05) rotate(2deg); opacity: 1; }
  100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
}
@keyframes card-deal-delayed {
  0%, 40% { transform: translate(80px, -60px) scale(0.3) rotate(-15deg); opacity: 0; }
  100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
}
@keyframes card-flip {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
}
.animate-card-deal { animation: card-deal 0.4s ease-out forwards; }
.animate-card-deal-delayed { animation: card-deal-delayed 0.55s ease-out forwards; }
.animate-card-flip { animation: card-flip 0.5s ease-in-out; }
.card-back {
  background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #1a365d 100%);
  border: 2px solid #c5a34f;
  backface-visibility: hidden;
}
.card-stagger-0 { animation-delay: 0s; }
.card-stagger-1 { animation-delay: 0.25s; }
.card-stagger-2 { animation-delay: 0.5s; }
.card-stagger-3 { animation-delay: 0.75s; }
.card-stagger-4 { animation-delay: 1s; }
`;

interface Card {
    suit: string;
    rank: string;
}

interface GameState {
    id: number;
    game_type: string;
    bet: number;
    status: string;
    player_cards: string[];
    dealer_cards: string[];
    player_score: number;
    dealer_score: number;
    can_double: boolean;
    can_surrender: boolean;
    result?: string;
    payout?: number;
}

const SUIT_ICONS: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_COLORS: Record<string, string> = { H: 'text-red-600', D: 'text-red-600', C: 'text-gray-900', S: 'text-gray-900' };

function parseCard(cardStr: string): Card | null {
    if (!cardStr || cardStr === '??') return null;
    const rank = cardStr.slice(0, -1);
    const suit = cardStr.slice(-1);
    return { rank, suit };
}

function cardDisplay(card: Card): { text: string; color: string } {
    return { text: `${card.rank}${SUIT_ICONS[card.suit] || ''}`, color: SUIT_COLORS[card.suit] || 'text-gray-900' };
}

function getStaggerClass(newCards: Set<number>, index: number): string {
    const sorted = [...newCards].sort((a, b) => a - b);
    const pos = sorted.indexOf(index);
    if (pos < 0) return '';
    return `card-stagger-${Math.min(pos, 4)}`;
}

function statusLabel(status: string, result?: string): string {
    if (status === 'playing') return 'Игра идёт...';
    if (status === 'player_won') {
        if (result === 'blackjack') return '🎉 Блэкджек! Выигрыш 3:2';
        return '🎉 Победа!';
    }
    if (status === 'dealer_won') {
        if (result === 'bust') return '💥 Перебор! Вы проиграли';
        if (result === 'dealer_blackjack') return '😔 Блэкджек у дилера';
        return '😔 Вы проиграли';
    }
    if (status === 'push') return '🤝 Ничья';
    if (status === 'surrender') return '🏳️ Вы сдались (возврат 50%)';
    return status;
}

export default function CasinoPage() {
    const { showToast } = useToast();
    const [tab, setTab] = useState('blackjack');
    const [game, setGame] = useState<GameState | null>(null);
    const [bet, setBet] = useState('');
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(0);
    const [actionCard, setActionCard] = useState<any>(null);

    // Анимации: отслеживаем предыдущее состояние для определения новых карт
    const prevPlayerCount = useRef(0);
    const prevDealerCount = useRef(0);
    const [newPlayerCards, setNewPlayerCards] = useState<Set<number>>(new Set());
    const [newDealerCards, setNewDealerCards] = useState<Set<number>>(new Set());
    const [flipDealerCard, setFlipDealerCard] = useState(false);

    // Загрузить карточку действия
    useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/casino'); if (c) setActionCard(c); }).catch(() => {}); }, []);

    // Загрузить баланс
    const loadBalance = async () => {
        try {
            const r = await fetch('/api/character/me', { headers: getHeaders() });
            const d = await r.json();
            setBalance(d.money || 0);
        } catch {}
    };

    // Загрузить активную игру
    const loadGame = async () => {
        try {
            const r = await fetch('/api/casino/active', { headers: getHeaders() });
            const d = await r.json();
            if (d.game) {
                applyAnimations(d.game);
                setGame(d.game);
            } else {
                setGame(null);
            }
        } catch {}
    };

    // Определить какие карты новые и запустить анимации
    const applyAnimations = (newGame: GameState) => {
        const oldPCount = prevPlayerCount.current;
        const oldDCount = prevDealerCount.current;
        const newPCount = newGame.player_cards.length;
        // Дилер: считаем только реальные карты (не '??')
        const realDealerCards = newGame.dealer_cards.filter(c => c !== '??');
        const newDCount = realDealerCards.length;

        // Все новые карты игрока (может быть несколько при старте)
        const pNew = new Set<number>();
        if (newPCount > oldPCount) {
            for (let i = oldPCount; i < newPCount; i++) pNew.add(i);
        }
        setNewPlayerCards(pNew);

        // Все новые карты дилера
        const dNew = new Set<number>();
        if (newDCount > oldDCount) {
            for (let i = oldDCount; i < newDCount; i++) dNew.add(i);
        }
        setNewDealerCards(dNew);

        // Flip скрытой карты дилера (когда игра кончилась и вторая карта была '??')
        if (newGame.status !== 'playing' && oldDCount === 1 && newDCount >= 2 && !flipDealerCard) {
            setFlipDealerCard(true);
            setTimeout(() => setFlipDealerCard(false), 600);
        }

        prevPlayerCount.current = newPCount;
        prevDealerCount.current = newDCount;
    };

    useEffect(() => { loadBalance(); loadGame(); }, []);

    // Старт игры
    const startGame = async () => {
        const betNum = parseInt(bet);
        if (!betNum || betNum <= 0) {
            showToast('Ставка должна быть больше 0');
            return;
        }
        if (betNum > balance) {
            showToast('Недостаточно денег');
            return;
        }
        setLoading(true);
        try {
            const r = await fetch('/api/casino/blackjack/start', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ bet: betNum }),
            });
            const d = await r.json();
            if (!r.ok) { showToast(d.error); setLoading(false); return; }
            applyAnimations(d);
            setGame(d);
            loadBalance();
        } catch { showToast('Ошибка сети'); }
        setLoading(false);
    };

    // Ход
    const hit = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/casino/blackjack/hit', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            });
            const d = await r.json();
            if (!r.ok) { showToast(d.error); setLoading(false); return; }
            applyAnimations(d);
            setGame(d);
            if (d.status !== 'playing') loadBalance();
        } catch { showToast('Ошибка сети'); }
        setLoading(false);
    };

    // Стоп
    const stand = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/casino/blackjack/stand', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            });
            const d = await r.json();
            if (!r.ok) { showToast(d.error); setLoading(false); return; }
            applyAnimations(d);
            setGame(d);
            loadBalance();
        } catch { showToast('Ошибка сети'); }
        setLoading(false);
    };

    // Удвоить
    const doubleDown = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/casino/blackjack/double', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            });
            const d = await r.json();
            if (!r.ok) { showToast(d.error); setLoading(false); return; }
            applyAnimations(d);
            setGame(d);
            loadBalance();
        } catch { showToast('Ошибка сети'); }
        setLoading(false);
    };

    // Сдаться
    const surrender = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/casino/blackjack/surrender', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            });
            const d = await r.json();
            if (!r.ok) { showToast(d.error); setLoading(false); return; }
            applyAnimations(d);
            setGame(d);
            loadBalance();
        } catch { showToast('Ошибка сети'); }
        setLoading(false);
    };

    const isPlaying = game?.status === 'playing';
    const isFinished = game && game.status !== 'playing';

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <style>{cardKeyframes}</style>
            <BackButton />
            {actionCard && <PageHeader title="Игорный дом" icon={actionCard.icon} bgImage={actionCard.bg_image} />}
            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-3">
                Испытай удачу в азартных играх! Доступные игры будут добавляться.
            </p>

            {/* Табы */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setTab('blackjack')}
                    className={`cursor-pointer px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'blackjack' ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'}`}
                >🃏 Блэкджек</button>
            </div>

            {tab === 'blackjack' && (
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border-default)]">
                    {/* Ставка */}
                    {!game && (
                        <div className="space-y-3">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Сделайте ставку. Блэкджек оплачивается 3:2. Дилер добирает до 17.
                            </p>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-[0.6rem] text-[var(--color-text-muted)]">Ставка</label>
                                    <input
                                        type={inputType}
                                        inputMode={isVK ? "none" : undefined}
                                        data-vk-num={isVK ? "true" : undefined}
                                        autoComplete="off"
                                        value={bet}
                                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setBet(v); }}
                                        placeholder="Любая сумма > 0"
                                        className={inputClass}
                                    />
                                </div>
                                <Button variant="danger" size="md" onClick={startGame} disabled={loading}>
                                    {loading ? '...' : 'Играть'}
                                </Button>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)]">Баланс: {formatMoney(balance)}</p>
                        </div>
                    )}

                    {/* Игровое поле */}
                    {game && (
                        <div className="space-y-4">
                            {/* Ставка */}
                            <div className="text-center text-sm">
                                <span className="text-[var(--color-text-muted)]">Ставка: </span>
                                <span className="text-[var(--color-accent-warning)] font-bold">{formatMoney(game.bet)}</span>
                            </div>

                            {/* Карты дилера */}
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                                    🏦 Дилер {isFinished ? `(${game.dealer_score})` : game.dealer_score > 0 ? `(${game.dealer_score})` : ''}
                                </p>
                                <div className="flex gap-2">
                                    {game.dealer_cards.map((c, i) => {
                                        const card = parseCard(c);
                                        const isNew = newDealerCards.has(i);
                                        const stagger = getStaggerClass(newDealerCards, i);
                                        const isHidden = !card;
                                        const isFlipping = isHidden && isFinished && i === 1;
                                        if (isHidden) return (
                                            <div key={i} className={`w-14 h-20 rounded-lg flex items-center justify-center text-2xl shadow-md
                                                ${isFlipping ? 'animate-card-flip' : ''}
                                                ${isNew ? `animate-card-deal ${stagger}` : ''}
                                                ${isFlipping ? 'bg-white border border-gray-300' : 'card-back'}`}>
                                                {isFlipping ? (
                                                    <span className="text-lg font-bold text-gray-900">?</span>
                                                ) : (
                                                    <span className="text-[var(--color-text-muted)]">?</span>
                                                )}
                                            </div>
                                        );
                                        const d = cardDisplay(card);
                                        return (
                                            <div key={i} className={`w-14 h-20 rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center shadow-md ${d.color} ${isNew ? `animate-card-deal-delayed ${stagger}` : ''} ${isFlipping ? 'animate-card-flip' : ''}`}>
                                                <span className="text-lg font-bold leading-tight">{card.rank}</span>
                                                <span className="text-base leading-tight">{SUIT_ICONS[card.suit]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Карты игрока */}
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                                    👤 Вы ({game.player_score})
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                    {game.player_cards.map((c, i) => {
                                        const card = parseCard(c);
                                        if (!card) return null;
                                        const d = cardDisplay(card);
                                        const isNew = newPlayerCards.has(i);
                                        const stagger = getStaggerClass(newPlayerCards, i);
                                        return (
                                            <div key={i} className={`w-14 h-20 rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center shadow-md ${d.color} ${isNew ? `animate-card-deal ${stagger}` : ''}`}>
                                                <span className="text-lg font-bold leading-tight">{card.rank}</span>
                                                <span className="text-base leading-tight">{SUIT_ICONS[card.suit]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Статус / результат */}
                            {isFinished && (
                                <div className={`text-center p-2 rounded-lg text-sm font-bold bg-[var(--color-bg-input)] ${
                                    game.status === 'player_won' ? 'text-[var(--color-accent-success)]' :
                                    game.status === 'dealer_won' ? 'text-[var(--color-accent-danger)]' :
                                    game.status === 'surrender' ? 'text-[var(--color-accent-warning)]' :
                                    'text-[var(--color-text-muted)]'
                                }`}>
                                    {statusLabel(game.status, game.result)}
                                    {game.payout !== undefined && (
                                        <div className="text-xs mt-0.5">
                                            {game.payout > 0 ? `+${formatMoney(game.payout)}` : formatMoney(game.payout)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Кнопки действий */}
                            {isPlaying && (
                                <div className="flex gap-2 justify-center flex-wrap">
                                    <Button variant="danger" size="md" onClick={hit} disabled={loading}>Взять</Button>
                                    <Button variant="secondary" size="md" onClick={stand} disabled={loading}>Стоп</Button>
                                    {game.can_double && (
                                        <Button variant="danger" size="md" onClick={doubleDown} disabled={loading}>Удвоить</Button>
                                    )}
                                    {game.can_surrender && (
                                        <Button variant="secondary" size="md" onClick={surrender} disabled={loading}>Сдаться</Button>
                                    )}
                                </div>
                            )}

                            {/* Новая игра */}
                            {isFinished && (
                                <div className="flex gap-2 justify-center">
                                    <Button variant="danger" size="md" onClick={() => { setGame(null); setBet(''); prevPlayerCount.current = 0; prevDealerCount.current = 0; }}>
                                        Новая игра
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
