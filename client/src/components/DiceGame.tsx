import { useState, useEffect } from 'react';
import Button from './ui/Button';
import { getHeaders } from '../api/helpers';
import { useToast } from '../contexts/ToastContext';
import { formatMoney } from '../utils/money';

const BETS = [10, 100, 1000];
const MAX_REROLLS = 2;

const DICE_FACES: Record<number, string> = {
    1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

const PAYOUT_TABLE = [
    ['Покер (5 одинак.)', '×50'],
    ['Каре (4 одинак.)', '×20'],
    ['Фулл-хаус (3+2)', '×10'],
    ['Стрит (1-5 или 2-6)', '×7'],
    ['Сет (3 одинак.)', '×4'],
    ['Две пары', '×2'],
    ['Пара', '×1 (свои)'],
];

interface GameState {
    gameId: number;
    dice: number[];
    rerollsUsed: number;
    entryFee: number;
}

interface FinishResult {
    dice: number[];
    combo: string;
    comboName: string;
    payout: number;
    profit: number;
}

export default function DiceGame({ onBalanceChange }: { onBalanceChange?: () => void }) {
    const [game, setGame] = useState<GameState | null>(null);
    const [keep, setKeep] = useState<Set<number>>(new Set());
    const [result, setResult] = useState<FinishResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(0);
    const [bet, setBet] = useState(10);
    const { showToast } = useToast();

    useEffect(() => {
        fetch('/api/character/me', { headers: getHeaders() })
            .then(r => r.json())
            .then(data => setBalance(data.money || 0))
            .catch(() => {});
    }, []);

    const toggleKeep = (idx: number) => {
        if (!game) return;
        const next = new Set(keep);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setKeep(next);
    };

    const startGame = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/dice/play', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ bet }),
            });
            const data = await r.json();
            if (!r.ok) { showToast(data.error || 'Ошибка', 'error'); return; }
            setGame(data);
            setKeep(new Set());
            setResult(null);
            onBalanceChange?.();
        } catch { showToast('Ошибка соединения', 'error'); }
        finally { setLoading(false); }
    };

    const reroll = async () => {
        if (!game || game.rerollsUsed >= MAX_REROLLS) return;
        setLoading(true);
        try {
            const r = await fetch('/api/dice/reroll', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: game.gameId, keep: [...keep] }),
            });
            const data = await r.json();
            if (!r.ok) { showToast(data.error || 'Ошибка', 'error'); return; }
            setGame({ ...game, dice: data.dice, rerollsUsed: data.rerollsUsed });
            setKeep(new Set());
        } catch { showToast('Ошибка соединения', 'error'); }
        finally { setLoading(false); }
    };

    const finish = async () => {
        if (!game) return;
        setLoading(true);
        try {
            const r = await fetch('/api/dice/finish', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: game.gameId }),
            });
            const data = await r.json();
            if (!r.ok) { showToast(data.error || 'Ошибка', 'error'); return; }
            setResult(data);
            setGame(null);
            setKeep(new Set());
            onBalanceChange?.();
        } catch { showToast('Ошибка соединения', 'error'); }
        finally { setLoading(false); }
    };

    const canAfford = (b: number) => balance >= b;

    return (
        <div>
            {!game && !result && (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-[var(--color-text-secondary)] text-left">
                        Брось 5 кубиков. Оставь нужные, перебрось остальные (до {MAX_REROLLS} раз). Собери комбинацию!
                    </p>
                    <div className="text-[0.65rem] text-[var(--color-text-muted)] text-left space-y-0.5">
                        {PAYOUT_TABLE.map(([name, mult]) => (
                            <div key={name} className="flex justify-between max-w-[240px]">
                                <span>{name}</span>
                                <span className="text-[var(--color-text-accent)]">{mult}</span>
                            </div>
                        ))}
                    </div>

                    {/* Выбор ставки + кнопка */}
                    <div className="flex gap-2 items-end">
                        <div className="flex gap-1.5">
                            {BETS.map(b => (
                                <button
                                    key={b}
                                    onClick={() => setBet(b)}
                                    className={`cursor-pointer px-3 py-1.5 rounded text-sm font-bold transition-colors ${
                                        bet === b
                                            ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)] border-2 border-[var(--color-text-primary)]'
                                            : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border-2 border-transparent'
                                    } ${!canAfford(b) ? 'opacity-40' : ''}`}
                                >
                                    {b} сер.
                                </button>
                            ))}
                        </div>
                        <Button onClick={startGame} disabled={loading || !canAfford(bet)} variant="danger">
                            {!canAfford(bet) ? 'Недостаточно' : loading ? '...' : 'Играть'}
                        </Button>
                    </div>
                </div>
            )}

            {game && (
                <div className="flex flex-col items-center gap-3">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                        Ставка: {formatMoney(game.entryFee)} | Перебросов: {game.rerollsUsed}/{MAX_REROLLS}
                    </div>
                    <div className="flex gap-2 justify-center flex-wrap">
                        {game.dice.map((d, i) => (
                            <button
                                key={i}
                                onClick={() => toggleKeep(i)}
                                disabled={game.rerollsUsed >= MAX_REROLLS}
                                className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-3xl sm:text-4xl rounded-lg border-2 transition-all ${
                                    keep.has(i)
                                        ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 scale-110'
                                        : 'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]'
                                } ${game.rerollsUsed >= MAX_REROLLS ? 'cursor-default' : 'cursor-pointer hover:border-[var(--color-accent-primary)]/50'}`}
                            >
                                {DICE_FACES[d]}
                            </button>
                        ))}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                        {game.rerollsUsed >= MAX_REROLLS
                            ? 'Нажми «Готово» чтобы получить выигрыш'
                            : 'Нажми на кубики чтобы оставить, затем «Бросить»'}
                    </div>
                    <div className="flex gap-2">
                        {game.rerollsUsed < MAX_REROLLS && (
                            <Button onClick={reroll} disabled={loading} size="sm">
                                {loading ? '...' : 'Бросить'}
                            </Button>
                        )}
                        <Button onClick={finish} disabled={loading} variant="secondary" size="sm">
                            {loading ? '...' : 'Готово'}
                        </Button>
                    </div>
                </div>
            )}

            {result && (
                <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-2 justify-center">
                        {result.dice.map((d, i) => (
                            <div key={i} className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-3xl sm:text-4xl rounded-lg border-2 border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
                                {DICE_FACES[d]}
                            </div>
                        ))}
                    </div>
                    <div className="text-lg font-bold">{result.comboName}</div>
                    <div className={`text-base font-bold ${result.profit >= 0 ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>
                        {result.payout > 0 ? `+${formatMoney(result.payout)} сер.` : '0 сер.'}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                        {result.profit > 0 ? `(прибыль: +${result.profit} сер.)` : result.profit < 0 ? `(убыток: ${result.profit} сер.)` : '(свои назад)'}
                    </div>
                    <Button onClick={startGame} disabled={loading || !canAfford(bet)} size="sm">
                        {!canAfford(bet) ? 'Недостаточно серебра' : loading ? '...' : 'Ещё раз'}
                    </Button>
                </div>
            )}
        </div>
    );
}
