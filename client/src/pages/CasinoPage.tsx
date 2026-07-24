import { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import BackButton from '../components/BackButton';
import PageHeader from '../components/ui/PageHeader';
import { getHeaders } from '../api/helpers';
import { useToast } from '../contexts/ToastContext';
import { formatMoney } from '../utils/money';
import { inputClass } from '../utils/formStyles';
import DiceGame from '../components/DiceGame';

const isVK = typeof document !== 'undefined' && document.documentElement.classList.contains('vk-iframe');
const inputType = isVK ? 'text' : 'number';

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
    const [todayGames, setTodayGames] = useState(0);
    const [remaining, setRemaining] = useState(10);

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
                setGame(d.game);
            } else {
                setGame(null);
            }
            setTodayGames(d.todayGames || 0);
            setRemaining(d.remaining ?? 10);
        } catch {}
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
            setGame(d);
            loadBalance();
        } catch { showToast('Ошибка сети'); }
        setLoading(false);
    };

    const isPlaying = game?.status === 'playing';
    const isFinished = game && game.status !== 'playing';

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
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
                <button
                    onClick={() => setTab('dice')}
                    className={`cursor-pointer px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'dice' ? 'bg-[var(--color-accent-info)] text-white' : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'}`}
                >🎲 Кости</button>
            </div>

            {tab === 'blackjack' && (
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border-default)]">
                    {/* Ставка */}
                    {!game && (
                        <div className="space-y-3">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Сделайте ставку. Блэкджек оплачивается 3:2. Дилер добирает до 17.
                            </p>
                            {remaining <= 0 ? (
                                <p className="text-sm text-[var(--color-accent-danger)] text-center py-2">
                                    🚫 Дневной лимит исчерпан (10/10). Возвращайтесь завтра!
                                </p>
                            ) : (
                                <>
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
                                <Button variant="danger" size="md" onClick={startGame} disabled={loading || remaining <= 0}>
                                    {loading ? '...' : 'Играть'}
                                </Button>
                            </div>
                            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                                <span>Баланс: {formatMoney(balance)}</span>
                                <span>Игр сегодня: <span className={remaining <= 3 ? 'text-[var(--color-accent-warning)]' : ''}>{todayGames}/10</span></span>
                            </div>
                                </>
                            )}
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
                                        if (!card) return (
                                            <div key={i} className="w-14 h-20 rounded-lg border-2 border-dashed border-[var(--color-border-default)] flex items-center justify-center text-2xl text-[var(--color-text-muted)]">?</div>
                                        );
                                        const d = cardDisplay(card);
                                        return (
                                            <div key={i} className={`w-14 h-20 rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center ${d.color}`}>
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
                                        return (
                                            <div key={i} className={`w-14 h-20 rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center ${d.color}`}>
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
                                    <Button variant="danger" size="md" onClick={() => { setGame(null); setBet(''); loadGame(); }}>
                                        Новая игра
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {tab === 'dice' && (
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border-default)]">
                    <DiceGame onBalanceChange={loadBalance} />
                </div>
            )}
        </div>
    );
}
