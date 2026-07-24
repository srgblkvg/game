import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

// ==================== БЛЭКДЖЕК ====================

type Suit = 'H' | 'D' | 'C' | 'S';
type Card = string; // e.g. 'AH', '10D', 'KS'

function createDeck(): Card[] {
    const suits: Suit[] = ['H', 'D', 'C', 'S'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    // 6 стандартных колод
    for (let d = 0; d < 6; d++) {
        for (const suit of suits) {
            for (const value of values) {
                deck.push(value + suit);
            }
        }
    }
    return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = tmp!;
    }
    return shuffled;
}

function cardValue(card: Card): number {
    const val = card.slice(0, -1); // remove suit
    if (val === 'A') return 11;
    if (['K', 'Q', 'J'].includes(val)) return 10;
    return parseInt(val);
}

function calculateScore(cards: Card[]): { score: number; isSoft: boolean } {
    let score = 0;
    let aces = 0;
    for (const card of cards) {
        const v = cardValue(card);
        if (v === 11) aces++;
        else score += v;
    }
    // Add aces optimally
    let soft = false;
    for (let i = 0; i < aces; i++) {
        if (score + 11 <= 21) {
            score += 11;
            soft = true;
        } else {
            score += 1;
        }
    }
    if (score > 21 && soft) {
        // If bust with soft, convert one ace at a time
        soft = false;
        // Recalculate: count all aces as 1
        score = 0;
        for (const card of cards) {
            const v = cardValue(card);
            score += v === 11 ? 1 : v;
        }
    }
    return { score, isSoft: soft && score <= 21 };
}

function isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && calculateScore(cards).score === 21;
}

function drawCards(deck: Card[], count: number): { drawn: Card[]; remaining: Card[] } {
    const drawn = deck.slice(0, count);
    const remaining = deck.slice(count);
    return { drawn, remaining };
}

const DAILY_LIMIT = 10;

// Посчитать сегодняшние игры пользователя по типу
async function countTodayGames(gameType: string, userId: number): Promise<number> {
    const row = await db.one(
        "SELECT COUNT(*) as cnt FROM casino_games WHERE user_id = ? AND game_type = ? AND created_at::date = CURRENT_DATE",
        [userId, gameType]
    );
    return row.cnt || 0;
}

// Получить активную игру пользователя
router.get('/casino/active', async (req, res) => {
    const userId = req.userId;
    const game = await db.one(
        "SELECT * FROM casino_games WHERE user_id = ? AND status = 'playing' ORDER BY created_at DESC LIMIT 1",
        [userId]
    );

    // Счётчик сегодняшних игр (для всех типов)
    const todayBJ = await countTodayGames('blackjack', userId);
    const remaining = Math.max(0, DAILY_LIMIT - todayBJ);

    if (!game) return res.json({ game: null, todayGames: todayBJ, dailyLimit: DAILY_LIMIT, remaining });

    // Не показываем вторую карту дилера до конца игры
    const dealerCards: string[] = JSON.parse(game.dealer_cards || '[]');
    const firstDealerCard: Card = dealerCards.length > 0 ? dealerCards[0]! : '??';
    const shownDealer: string[] = dealerCards.length > 0 ? [firstDealerCard, '??'] : [];

    res.json({
        game: {
            id: game.id,
            game_type: game.game_type,
            bet: game.bet,
            status: game.status,
            player_cards: JSON.parse(game.player_cards || '[]'),
            dealer_cards: shownDealer,
            player_score: game.player_score,
            dealer_score: dealerCards.length > 0 ? calculateScore([dealerCards[0]!]).score : 0,
            can_double: JSON.parse(game.player_cards || '[]').length === 2,
            can_surrender: JSON.parse(game.player_cards || '[]').length === 2,
        },
        todayGames: todayBJ,
        dailyLimit: DAILY_LIMIT,
        remaining,
    });
});

// Старт игры
router.post('/casino/blackjack/start', async (req, res) => {
    const userId = req.userId;
    const bet = parseInt(req.body.bet);
    if (!bet || bet <= 0) return res.status(400).json({ error: 'Ставка должна быть больше 0' });

    // Проверить, нет ли уже активной игры
    const active = await db.one(
        "SELECT id FROM casino_games WHERE user_id = ? AND status = 'playing' LIMIT 1",
        [userId]
    );
    if (active) return res.status(400).json({ error: 'У вас уже есть активная игра. Завершите её.' });

    // Проверить дневной лимит
    const todayCount = await countTodayGames('blackjack', userId);
    if (todayCount >= DAILY_LIMIT) return res.status(400).json({ error: `Дневной лимит исчерпан (${todayCount}/${DAILY_LIMIT}). Возвращайтесь завтра!` });

    // Проверить деньги
    try {
        await db.tx(async (client) => {
            const user = (await client.query('SELECT money FROM users WHERE id = $1', [userId])).rows[0] as any;
            if (!user || user.money < bet) throw new Error('no_money');

            // Списать ставку
            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [bet, userId]);

            // Создать колоду и сдать карты
            const deck = shuffleDeck(createDeck());
            const { drawn: pCards, remaining: afterPlayer } = drawCards(deck, 2);
            const { drawn: dCards, remaining: finalDeck } = drawCards(afterPlayer, 2);

            const pScore = calculateScore(pCards);
            const dScore = calculateScore(dCards);

            // Проверить мгновенный блэкджек
            let status = 'playing';
            let result = '';
            let payout = 0;

            const playerBJ = isBlackjack(pCards);
            const dealerBJ = isBlackjack(dCards);

            if (playerBJ && dealerBJ) {
                status = 'push';
                result = 'push';
                payout = bet; // возврат ставки
            } else if (playerBJ) {
                status = 'player_won';
                result = 'blackjack';
                payout = Math.floor(bet * 2.5); // 3:2
            } else if (dealerBJ) {
                status = 'dealer_won';
                result = 'dealer_blackjack';
                payout = 0;
            }

            const gameResult = await client.query(
                `INSERT INTO casino_games (user_id, game_type, bet, status, player_cards, dealer_cards, deck, player_score, dealer_score)
                 VALUES ($1, 'blackjack', $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
                [userId, bet, status, JSON.stringify(pCards), JSON.stringify(dCards), JSON.stringify(finalDeck), pScore.score, dScore.score]
            );

            if (payout > 0) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [payout, userId]);
            }
            // Статистика казино (если игра завершилась мгновенно — блэкджек)
            if (status !== 'playing') {
                const { won: _bjwon, lost: _bjlost } = getCasinoStatUpdate(status, bet, payout);
                await client.query(
                    'UPDATE users SET casino_games_played = casino_games_played + 1, casino_won = casino_won + $1, casino_lost = casino_lost + $2 WHERE id = $3',
                    [_bjwon, _bjlost, userId]
                );
            }

            res.json({
                gameId: gameResult.rows[0].id,
                status,
                result,
                player_cards: pCards,
                dealer_cards: status === 'playing' ? [dCards[0]!, '??'] : dCards,
                player_score: pScore.score,
                dealer_score: status === 'playing' ? cardValue(dCards[0]!) : dScore.score,
                bet,
                payout,
                can_double: status === 'playing',
                can_surrender: status === 'playing',
            });
        });
    } catch (e: any) {
        if (e.message === 'no_money') return res.status(400).json({ error: 'Недостаточно денег' });
        throw e;
    }
});

// Ход — взять карту
router.post('/casino/blackjack/hit', async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.tx(async (client) => {
            const game = (await client.query(
                "SELECT * FROM casino_games WHERE user_id = $1 AND status = 'playing' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
                [userId]
            )).rows[0] as any;

            if (!game) throw new Error('no_game');

            const deck: Card[] = JSON.parse(game.deck || '[]');
            const playerCards: Card[] = JSON.parse(game.player_cards || '[]');
            const dealerCards: Card[] = JSON.parse(game.dealer_cards || '[]');

            if (deck.length === 0) throw new Error('no_cards');

            // Взять одну карту
            const newCard = deck[0]!;
            const newDeck = deck.slice(1);
            playerCards.push(newCard);

            const pScore = calculateScore(playerCards);

            if (pScore.score > 21) {
                // Bust
                await client.query(
                    "UPDATE casino_games SET player_cards = $1, deck = $2, player_score = $3, status = 'dealer_won', finished_at = NOW() WHERE id = $4",
                    [JSON.stringify(playerCards), JSON.stringify(newDeck), pScore.score, game.id]
                );
                return {
                    status: 'dealer_won', result: 'bust',
                    player_cards: playerCards, dealer_cards: dealerCards,
                    player_score: pScore.score,
                    dealer_score: calculateScore(dealerCards).score,
                    bet: game.bet, payout: 0, can_double: false, can_surrender: false,
                };
            }

            await client.query(
                'UPDATE casino_games SET player_cards = $1, deck = $2, player_score = $3 WHERE id = $4',
                [JSON.stringify(playerCards), JSON.stringify(newDeck), pScore.score, game.id]
            );

            return {
                status: 'playing',
                player_cards: playerCards,
                dealer_cards: [dealerCards[0]!, '??'],
                player_score: pScore.score,
                dealer_score: cardValue(dealerCards[0]!),
                bet: game.bet, payout: 0, can_double: false, can_surrender: false,
            };
        });

        res.json(result);
    } catch (e: any) {
        if (e.message === 'no_game') return res.status(400).json({ error: 'Нет активной игры' });
        if (e.message === 'no_cards') return res.status(500).json({ error: 'В колоде закончились карты' });
        throw e;
    }
});

// Стоп — дилер добирает
router.post('/casino/blackjack/stand', async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.tx(async (client) => {
            const game = (await client.query(
                "SELECT * FROM casino_games WHERE user_id = $1 AND status = 'playing' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
                [userId]
            )).rows[0] as any;

            if (!game) throw new Error('no_game');

            let deck: Card[] = JSON.parse(game.deck || '[]');
            const playerCards: Card[] = JSON.parse(game.player_cards || '[]');
            const dealerCards: Card[] = JSON.parse(game.dealer_cards || '[]');

            const pScore = calculateScore(playerCards);

            // Дилер добирает до 17
            while (true) {
                const dScore = calculateScore(dealerCards);
                if (dScore.score >= 17) break;
                if (deck.length === 0) break;
                dealerCards.push(deck[0]!);
                deck = deck.slice(1);
            }

            const dScore = calculateScore(dealerCards);
            let status: string;
            let result: string;
            let payout = 0;

            if (dScore.score > 21) {
                status = 'player_won';
                result = 'dealer_bust';
                payout = game.bet * 2; // возврат ставки + выигрыш 1:1
            } else if (pScore.score > dScore.score) {
                status = 'player_won';
                result = 'win';
                payout = game.bet * 2;
            } else if (dScore.score > pScore.score) {
                status = 'dealer_won';
                result = 'lose';
                payout = 0;
            } else {
                status = 'push';
                result = 'push';
                payout = game.bet; // возврат ставки
            }

            await client.query(
                "UPDATE casino_games SET dealer_cards = $1, deck = $2, dealer_score = $3, player_score = $4, status = $5, finished_at = NOW() WHERE id = $6",
                [JSON.stringify(dealerCards), JSON.stringify(deck), dScore.score, pScore.score, status, game.id]
            );

            if (payout > 0) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [payout, userId]);
            }
            // Статистика казино
            const { won: _swon, lost: _slost } = getCasinoStatUpdate(status, game.bet, payout);
            await client.query(
                'UPDATE users SET casino_games_played = casino_games_played + 1, casino_won = casino_won + $1, casino_lost = casino_lost + $2 WHERE id = $3',
                [_swon, _slost, userId]
            );

            return {
                status, result,
                player_cards: playerCards, dealer_cards: dealerCards,
                player_score: pScore.score, dealer_score: dScore.score,
                bet: game.bet, payout,
                can_double: false, can_surrender: false,
            };
        });

        res.json(result);
    } catch (e: any) {
        if (e.message === 'no_game') return res.status(400).json({ error: 'Нет активной игры' });
        throw e;
    }
});

// Удвоить ставку (double down)
router.post('/casino/blackjack/double', async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.tx(async (client) => {
            const game = (await client.query(
                "SELECT * FROM casino_games WHERE user_id = $1 AND status = 'playing' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
                [userId]
            )).rows[0] as any;

            if (!game) throw new Error('no_game');

            const playerCards: Card[] = JSON.parse(game.player_cards || '[]');
            if (playerCards.length !== 2) throw new Error('not_allowed');

            // Проверить деньги на удвоение
            const user = (await client.query('SELECT money FROM users WHERE id = $1', [userId])).rows[0] as any;
            if (!user || user.money < game.bet) throw new Error('no_money');

            // Списать ещё ставку
            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [game.bet, userId]);

            const newBet = game.bet * 2;
            let deck: Card[] = JSON.parse(game.deck || '[]');
            const dealerCards: Card[] = JSON.parse(game.dealer_cards || '[]');

            if (deck.length === 0) throw new Error('no_cards');

            // Взять одну карту
            playerCards.push(deck[0]!);
            deck = deck.slice(1);

            const pScore = calculateScore(playerCards);

            if (pScore.score > 21) {
                // Bust
                await client.query(
                    "UPDATE casino_games SET player_cards = $1, deck = $2, player_score = $3, bet = $4, status = 'dealer_won', finished_at = NOW() WHERE id = $5",
                    [JSON.stringify(playerCards), JSON.stringify(deck), pScore.score, newBet, game.id]
                );
                return {
                    status: 'dealer_won', result: 'bust',
                    player_cards: playerCards,
                    dealer_cards: dealerCards,
                    player_score: pScore.score,
                    dealer_score: calculateScore(dealerCards).score,
                    bet: newBet, payout: 0, can_double: false, can_surrender: false,
                };
            }

            // Дилер добирает до 17
            while (true) {
                const dScore = calculateScore(dealerCards);
                if (dScore.score >= 17) break;
                if (deck.length === 0) break;
                dealerCards.push(deck[0]!);
                deck = deck.slice(1);
            }

            const dScore = calculateScore(dealerCards);
            let status: string;
            let result: string;
            let payout = 0;

            if (dScore.score > 21) {
                status = 'player_won';
                result = 'dealer_bust';
                payout = newBet * 2;
            } else if (pScore.score > dScore.score) {
                status = 'player_won';
                result = 'win';
                payout = newBet * 2;
            } else if (dScore.score > pScore.score) {
                status = 'dealer_won';
                result = 'lose';
                payout = 0;
            } else {
                status = 'push';
                result = 'push';
                payout = newBet;
            }

            await client.query(
                "UPDATE casino_games SET player_cards = $1, dealer_cards = $2, deck = $3, player_score = $4, dealer_score = $5, bet = $6, status = $7, finished_at = NOW() WHERE id = $8",
                [JSON.stringify(playerCards), JSON.stringify(dealerCards), JSON.stringify(deck), pScore.score, dScore.score, newBet, status, game.id]
            );

            if (payout > 0) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [payout, userId]);
            }
            // Статистика казино
            const { won: _dwon, lost: _dlost } = getCasinoStatUpdate(status, newBet, payout);
            await client.query(
                'UPDATE users SET casino_games_played = casino_games_played + 1, casino_won = casino_won + $1, casino_lost = casino_lost + $2 WHERE id = $3',
                [_dwon, _dlost, userId]
            );

            return {
                status, result,
                player_cards: playerCards, dealer_cards: dealerCards,
                player_score: pScore.score, dealer_score: dScore.score,
                bet: newBet, payout,
                can_double: false, can_surrender: false,
            };
        });

        res.json(result);
    } catch (e: any) {
        if (e.message === 'no_game') return res.status(400).json({ error: 'Нет активной игры' });
        if (e.message === 'not_allowed') return res.status(400).json({ error: 'Удвоение доступно только на первых двух картах' });
        if (e.message === 'no_money') return res.status(400).json({ error: 'Недостаточно денег для удвоения' });
        if (e.message === 'no_cards') return res.status(500).json({ error: 'В колоде закончились карты' });
        throw e;
    }
});

// Сдаться (surrender) — вернуть 50% ставки
router.post('/casino/blackjack/surrender', async (req, res) => {
    const userId = req.userId;

    try {
        const result = await db.tx(async (client) => {
            const game = (await client.query(
                "SELECT * FROM casino_games WHERE user_id = $1 AND status = 'playing' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
                [userId]
            )).rows[0] as any;

            if (!game) throw new Error('no_game');

            const playerCards: Card[] = JSON.parse(game.player_cards || '[]');
            if (playerCards.length !== 2) throw new Error('not_allowed');

            const returnAmount = Math.floor(game.bet / 2);

            await client.query(
                "UPDATE casino_games SET status = 'surrender', finished_at = NOW() WHERE id = $1",
                [game.id]
            );

            if (returnAmount > 0) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [returnAmount, userId]);
            }
            // Статистика казино
            const { won: _surwon, lost: _surlost } = getCasinoStatUpdate('surrender', game.bet, returnAmount);
            await client.query(
                'UPDATE users SET casino_games_played = casino_games_played + 1, casino_won = casino_won + $1, casino_lost = casino_lost + $2 WHERE id = $3',
                [_surwon, _surlost, userId]
            );

            const dealerCards: Card[] = JSON.parse(game.dealer_cards || '[]');

            return {
                status: 'surrender', result: 'surrender',
                player_cards: playerCards,
                dealer_cards: dealerCards,
                player_score: calculateScore(playerCards).score,
                dealer_score: calculateScore(dealerCards).score,
                bet: game.bet, payout: returnAmount,
                can_double: false, can_surrender: false,
            };
        });

        res.json(result);
    } catch (e: any) {
        if (e.message === 'no_game') return res.status(400).json({ error: 'Нет активной игры' });
        if (e.message === 'not_allowed') return res.status(400).json({ error: 'Сдаться можно только на первых двух картах' });
        throw e;
    }
});

export default router;

// Хелпер: обновление статов казино у пользователя
// casino_won = чистая прибыль от побед, casino_lost = чистый убыток от поражений
function getCasinoStatUpdate(status: string, bet: number, payout: number): { won: number; lost: number } {
    if (status === 'player_won') return { won: payout - bet, lost: 0 };
    if (status === 'dealer_won') return { won: 0, lost: bet };
    if (status === 'surrender') return { won: 0, lost: bet - payout };
    return { won: 0, lost: 0 }; // push
}
