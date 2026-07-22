import { Router } from 'express';
import { db, pool } from '../db/index';
import { runBattle } from '../game/battle';
import { getBaseStats, enrichEquipment, addMoney } from '../db/helpers';
import { currentStats } from '../game/stats';
import { broadcast } from '../events';
import { getDrinkBonuses } from '../game/drinks';

const router = Router();

const MAX_PLAYERS = 8;
const REGISTRATION_WINDOW = 60 * 60; // 1 час

const divisions = [
    { name: 'copper',    label: 'Медный',      tier: 1,  minLevel: 1,  maxLevel: 5,  icon: '🥉' },
    { name: 'bronze',    label: 'Бронзовый',    tier: 2,  minLevel: 3,  maxLevel: 7,  icon: '🥉' },
    { name: 'iron',      label: 'Железный',     tier: 3,  minLevel: 5,  maxLevel: 9,  icon: '🥈' },
    { name: 'steel',     label: 'Стальной',     tier: 4,  minLevel: 7,  maxLevel: 11, icon: '🥈' },
    { name: 'silver',    label: 'Серебряный',   tier: 5,  minLevel: 9,  maxLevel: 13, icon: '🥈' },
    { name: 'gold',      label: 'Золотой',      tier: 6,  minLevel: 11, maxLevel: 15, icon: '🥇' },
    { name: 'platinum',  label: 'Платиновый',   tier: 7,  minLevel: 13, maxLevel: 17, icon: '🥇' },
    { name: 'mithril',   label: 'Мифриловый',   tier: 8,  minLevel: 15, maxLevel: 19, icon: '🥇' },
    { name: 'adamant',   label: 'Адамантиновый',tier: 9,  minLevel: 17, maxLevel: 21, icon: '👑' },
    { name: 'orichalcum',label: 'Орихалковый',  tier: 10, minLevel: 19, maxLevel: 999,icon: '💎' },
];
const TIERS_TOTAL = 55; // 1+2+3+4+5+6+7+8+9+10

// Расчёт призового фонда дивизиона: 50% казны * tier / TIERS_TOTAL
async function calcDivisionPool(tier: number): Promise<number> {
    try {
        const { getTreasury } = await import('../game/treasury');
        const treasury = await getTreasury();
        const half = Math.floor(treasury * 0.5);
        return Math.floor(half * tier / TIERS_TOTAL);
    } catch { return 0; }
}

// ---------------------------------------------------------------------------
// Брекет
// ---------------------------------------------------------------------------

function nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

/**
 * Создать сетку первого раунда.
 * Участники сортируются: goldenTicket DESC, затем userId.
 * Добиваем до степени 2 нулями (bye).
 * Пары: 1-й с последним, 2-й с предпоследним и т.д.
 */
async function generateBracket(tournamentId: number) {
    // Проверяем, что сетка ещё не создана
    const existing = await db.one('SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournamentid = ?', [tournamentId]) as any;
    if (existing?.cnt > 0) {
        console.log(`[bracket] tid=${tournamentId} already has matches, skip`);
        return;
    }

    const partRows = await pool.query(
        `SELECT tp.userid, u.tournamentelo FROM tournament_participants tp JOIN users u ON tp.userid = u.id WHERE tp.tournamentid = $1 ORDER BY u.tournamentelo ASC`,
        [tournamentId]
    );
    const participants = partRows.rows;
    const getUserId = (p: any) => p ? p.userid : null;

    console.log(`[bracket] tid=${tournamentId} participants=${participants.length}`);
    if (participants.length < 2) {
        console.log(`[bracket] tid=${tournamentId} SKIP < 2`);
        // Отмена
        const t = await db.one('SELECT * FROM tournaments WHERE id = ?', [tournamentId]) as any;
        if (t && t.type === 'custom') {
            // Возврат базового призового фонда создателю
            if ((t.basePool || 0) > 0) {
                await db.run('UPDATE users SET money = money + ? WHERE id = ?', [t.basePool, t.creatorId]);
            }
            // Возврат входных взносов всем участникам
            if ((t.entryFee || 0) > 0) {
                const parts = await db.query(
                    'SELECT userId FROM tournament_participants WHERE tournamentId = ?',
                    [tournamentId]
                ) as any[];
                for (const p of parts) {
                    await db.run('UPDATE users SET money = money + ? WHERE id = ?', [t.entryFee, p.userId]);
                }
            }
        }
        await db.run('UPDATE tournaments SET status = ?, completedAt = ? WHERE id = ?', ['cancelled', new Date().toISOString(), tournamentId]);
        return;
    }

    const n = participants.length;
    const slots = nextPowerOfTwo(n);
    const byes = slots - n;  // сколько игроков проходят без боя
    const playInRound1 = n - byes;  // сколько играют в 1-м раунде

    console.log('[bracket] n=' + n + ' slots=' + slots + ' byes=' + byes + ' playR1=' + playInRound1);

    // Сильнейшие (первые byes в отсортированном по ELO массиве) получают bye
    for (let i = 0; i < byes; i++) {
        const p = participants[i];
        await pool.query(
            'INSERT INTO tournament_matches (tournamentid, round, player1id, player2id, winnerid) VALUES ($1, 1, $2, NULL, $2) RETURNING id',
            [tournamentId, p.userid]
        );
        console.log('[bracket] bye: userid=' + p.userid + ' -> round 2');
    }

    // Остальные играют попарно (соседние по ELO)
    for (let i = 0; i < playInRound1 / 2; i++) {
        const p1 = participants[byes + i * 2];
        const p2 = participants[byes + i * 2 + 1];

        await pool.query(
            'INSERT INTO tournament_matches (tournamentid, round, player1id, player2id) VALUES ($1, 1, $2, $3) RETURNING id',
            [tournamentId, p1.userid, p2.userid]
        );
        console.log('[bracket] R1: ' + p1.userid + ' vs ' + p2.userid);
    }
}

// ---------------------------------------------------------------------------
// Симуляция раунда
// ---------------------------------------------------------------------------

async function loadPlayerForBattle(userId: number) {
    const u = await db.one(`
        SELECT id, username, level, money, baseS, baseA, baseD, baseM,
               equipment, currentHp, activeDrink, drinkUntil
        FROM users WHERE id = ?
    `, [userId]) as any;
    if (!u) return null;

    let equipment: Record<string, any> = {};
    try { equipment = JSON.parse(u.equipment || '{}'); } catch {}

    const { enriched } = await enrichEquipment(equipment);
    const base = getBaseStats(u);
    const collCnt = (await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]) as any).cnt || 0;
    const drinkBonuses = getDrinkBonuses(u);
    const stats = currentStats(base, enriched, drinkBonuses, collCnt);

    return {
        id: u.id,
        name: u.username,
        base,
        equipment: enriched,
        level: u.level,
        money: u.money || 0,
        currentHp: stats.hp, // всегда полное HP для турнирных боёв
        drinkBonuses,
        collectionBonus: collCnt,
    };
}

/**
 * Разрешить все незавершённые матчи текущего раунда.
 * Возвращает номер разрешённого раунда (или 0 если ничего не сделано).
 */
export async function resolveCurrentRound(tournamentId: number): Promise<number> {
    // Находим минимальный раунд с незавершёнными матчами
    const pendingRound = await db.one(`
        SELECT round FROM tournament_matches
        WHERE tournamentId = ? AND winnerId IS NULL
        ORDER BY round LIMIT 1
    `, [tournamentId]) as any;

    if (!pendingRound) return 0;

    const round = pendingRound.round;
    const matches = await db.query(`
        SELECT * FROM tournament_matches
        WHERE tournamentId = ? AND round = ? AND winnerId IS NULL
    `, [tournamentId, round]) as any[];

    for (const match of matches) {
        if (!match.player1Id || !match.player2Id) continue; // bye уже обработан

        const p1 = await loadPlayerForBattle(match.player1Id);
        const p2 = await loadPlayerForBattle(match.player2Id);
        if (!p1 || !p2) continue;

        const result = runBattle(p1, p2);
        // В турнирах серебро не воруем — убираем money-шаги из лога
        const tourSteps = result.steps.filter((s: any) => s.type !== 'money');
        await db.run('UPDATE tournament_matches SET winnerId = ?, log = ? WHERE id = ?', [result.winnerId, JSON.stringify(tourSteps), match.id]);
    }

    return round;
}

/**
 * После завершения раунда создать матчи следующего раунда из победителей.
 */
async function advanceWinners(tournamentId: number, finishedRound: number) {
    const nextRound = finishedRound + 1;

    // Sanity guard: жёсткий предел раундов — не даём лавине разрастись
    // ceil(log2(MAX_PLAYERS=128)) + 2 = 9, берём с запасом 32
    if (nextRound > 32) {
        console.error(`[advanceWinners] tid=${tournamentId} nextRound=${nextRound} exceeds limit — forcing finish`);
        await finishTournament(tournamentId);
        return;
    }

    // Идемпотентность: если матчи этого раунда уже созданы — пропускаем
    const existingCnt = (await db.one(
        'SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournamentid = ? AND round = ?',
        [tournamentId, nextRound]
    ) as any)?.cnt || 0;
    if (existingCnt > 0) {
        console.log(`[advanceWinners] tid=${tournamentId} round=${nextRound} already has ${existingCnt} matches — skipping`);
        return;
    }

    const winners = await db.query(`
        SELECT winnerId FROM tournament_matches
        WHERE tournamentId = ? AND round = ? AND winnerId IS NOT NULL
        ORDER BY id
    `, [tournamentId, finishedRound]) as any[];

    if (winners.length < 2) {
        // Турнир завершён — остался один победитель
        await finishTournament(tournamentId);
        return;
    }

    // Соседние пары: 1-2, 3-4...
    const n = winners.length;
    const half = Math.floor(n / 2);
    for (let i = 0; i < half; i++) {
        const info = await db.run(`
            INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId)
            VALUES (?, ?, ?, ?, NULL)
        `, [tournamentId, nextRound, winners[i * 2].winnerId, winners[i * 2 + 1].winnerId]);
    }
    // Нечётный победитель — проходит автоматом (bye)
    if (n % 2 === 1) {
        await db.run(`
            INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId)
            VALUES (?, ?, ?, NULL, ?)
        `, [tournamentId, nextRound, winners[n - 1].winnerId, winners[n - 1].winnerId]);
    }
}

// ---------------------------------------------------------------------------
// Завершение турнира и призы
// ---------------------------------------------------------------------------

async function finishTournament(tournamentId: number) {
    const t = await db.one('SELECT * FROM tournaments WHERE id = ?', [tournamentId]) as any;
    if (!t || t.status === 'completed' || t.status === 'cancelled') return;

    const prizePool = t.prizePool || 0;

    // Собираем результаты: финал (последний раунд) → 1-е место,
    // проигравший в финале → 2-е место,
    // полуфиналисты → 3-е место (берём того, кто проиграл победителю)
    const lastRound = await db.one(`
        SELECT MAX(round) as maxRound FROM tournament_matches WHERE tournamentId = ?
    `, [tournamentId]) as any;
    const finalRound = lastRound?.maxRound || 1;

    // Победитель (1-е место) — winnerId последнего матча финала
    const finalMatches = await db.query(`
        SELECT * FROM tournament_matches WHERE tournamentId = ? AND round = ?
    `, [tournamentId, finalRound]) as any[];

    if (finalMatches.length === 0) return;

    const winnerId = finalMatches[0].winnerId;
    if (!winnerId) return;

    // 2-е место — проигравший в финале
    let secondPlaceId: number | null = null;
    for (const fm of finalMatches) {
        if (fm.winnerId === winnerId) {
            secondPlaceId = fm.player1Id === winnerId ? fm.player2Id : fm.player1Id;
            break;
        }
    }

    // 3-е место — проигравшие в полуфинале (первый, кто не чемпион и не 2-е место)
    let thirdPlaceId: number | null = null;
    if (finalRound >= 2) {
        const semiMatches = await db.query(`
            SELECT * FROM tournament_matches WHERE tournamentId = ? AND round = ?
        `, [tournamentId, finalRound - 1]) as any[];

        for (const sm of semiMatches) {
            if (!sm.winnerId) continue;
            const loser = sm.player1Id === sm.winnerId ? sm.player2Id : sm.player1Id;
            console.log('[finish] semi loser:', loser, 'winnerId:', winnerId, 'secondPlaceId:', secondPlaceId);
            if (loser && loser !== winnerId && loser !== secondPlaceId) {
                thirdPlaceId = loser;
                break;
            }
        }
    }
    console.log('[finish] tid=' + tournamentId + ' prizes: 1st=' + winnerId + ' 2nd=' + secondPlaceId + ' 3rd=' + thirdPlaceId + ' pool=' + prizePool);

    // Распределение призов
    let firstPrize: number, secondPrize: number, thirdPrize: number;

    if (!secondPlaceId) {
        // 1 участник — всё победителю
        firstPrize = prizePool;
        secondPrize = 0;
        thirdPrize = 0;
    } else if (!thirdPlaceId) {
        // 2 участника — 70/30
        firstPrize = Math.floor(prizePool * 0.7);
        secondPrize = prizePool - firstPrize;
        thirdPrize = 0;
    } else {
        // 3+ участников — 50/30/20
        firstPrize = Math.floor(prizePool * 0.5);
        secondPrize = Math.floor(prizePool * 0.3);
        thirdPrize = prizePool - firstPrize - secondPrize;
    }

    if (prizePool > 0) {
        addMoney(winnerId, firstPrize);
        if (secondPlaceId) addMoney(secondPlaceId, secondPrize);
        if (thirdPlaceId) addMoney(thirdPlaceId, thirdPrize);
    }

    // Сохраняем результаты в таблицу tournament_participants
    await db.run('UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?',
        [JSON.stringify({ place: 1, prize: firstPrize }), tournamentId, winnerId]);
    await db.run('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?', [winnerId]);
    if (secondPlaceId) {
        await db.run('UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?',
            [JSON.stringify({ place: 2, prize: secondPrize }), tournamentId, secondPlaceId]);
        await db.run('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?', [secondPlaceId]);
    }
    if (thirdPlaceId) {
        await db.run('UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?',
            [JSON.stringify({ place: 3, prize: thirdPrize }), tournamentId, thirdPlaceId]);
        await db.run('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?', [thirdPlaceId]);
    }

    await db.run('UPDATE tournaments SET status = ?, completedAt = ? WHERE id = ?', ['completed', new Date().toISOString(), tournamentId]);

    // --- Обновление скрытого tournamentElo для посева ---
    // Победитель +25, 2-е +15, 3-е +10, полуфиналисты +5, остальные 0
    // Проигравшие в первом раунде получают небольшой минус
    const allParts = await db.query(
        'SELECT userId FROM tournament_participants WHERE tournamentId = ?',
        [tournamentId]
    ) as any[];

    for (const p of allParts) {
        let delta = 0;
        if (p.userId === winnerId) delta = 25;
        else if (p.userId === secondPlaceId) delta = 15;
        else if (p.userId === thirdPlaceId) delta = 10;
        else {
            // Проверяем, прошёл ли игрок дальше первого раунда
            const wonInR1 = await db.one(
                'SELECT id FROM tournament_matches WHERE tournamentId = ? AND round = 1 AND winnerId = ?',
                [tournamentId, p.userId]
            ) as any;
            if (wonInR1) delta = 3; // прошёл первый раунд
            else delta = -3;        // вылетел в первом раунде
        }
        await db.run('UPDATE users SET tournamentElo = GREATEST(100, tournamentElo + ?) WHERE id = ?',
            [delta, p.userId]);
    }
}

// ---------------------------------------------------------------------------
// Автопродвижение (вызывается при каждом GET /tournament)
// ---------------------------------------------------------------------------

export async function autoAdvance(tournamentId: number) {
    // Advisory lock per-tournament — защита от параллельных вызовов
    // pg_try_advisory_xact_lock возвращает true если лок получен, false если уже занят
    const locked = (await db.one('SELECT pg_try_advisory_xact_lock(?) as locked', [tournamentId]) as any)?.locked;
    if (!locked) {
        // Другой вызов уже обрабатывает этот турнир — просто выходим
        return;
    }

    const t = await db.one('SELECT * FROM tournaments WHERE id = ?', [tournamentId]) as any;
    if (!t) return;

    const now = Math.floor(Date.now() / 1000);

    if (t.status === 'registration' && now >= t.registrationEnd) {
        console.log(`[autoAdv] tid=${tournamentId} registration→in_progress`);
        // Время регистрации истекло — стартуем
        await db.run('UPDATE tournaments SET status = ? WHERE id = ?', ['in_progress', tournamentId]);
        await generateBracket(tournamentId);
        await autoAdvance(tournamentId);
        return;
    }

    if (t.status === 'in_progress') {
        const matchCount = (await db.one('SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournamentid = ?', [tournamentId]) as any).cnt;
        if (matchCount === 0) {
            console.log('[autoAdv] tid=' + tournamentId + ' in_progress but 0 matches - regenerating bracket');
            await generateBracket(tournamentId);
            await autoAdvance(tournamentId);
            return;
        }
        const resolvedRound = await resolveCurrentRound(tournamentId);
        if (resolvedRound > 0) {
            await advanceWinners(tournamentId, resolvedRound);
            await autoAdvance(tournamentId);
        }
        return;
    }

    // Если турнир завершён или отменён — создаём новый для этого дивизиона (только official)
    // через 1 час после завершения ПОСЛЕДНЕГО турнира
    if ((t.status === 'completed' || t.status === 'cancelled') && t.type === 'official') {
        const existing = await db.one(
            "SELECT id FROM tournaments WHERE division = ? AND status IN ('registration', 'in_progress')",
            [t.division]
        ) as any;
        if (!existing) {
            // Ждём час после завершения ПОСЛЕДНЕГО турнира этого дивизиона
            const lastCompleted = await db.one(
                "SELECT completedAt FROM tournaments WHERE division = ? AND type = 'official' AND status IN ('completed', 'cancelled') ORDER BY id DESC LIMIT 1",
                [t.division]
            ) as any;
            if (lastCompleted?.completedAt) {
                const ts = typeof lastCompleted.completedAt === 'number' ? lastCompleted.completedAt * 1000
                  : Number(lastCompleted.completedAt) || new Date(lastCompleted.completedAt).getTime();
                const oneHourLater = ts + 3600 * 1000;
                if (Date.now() < oneHourLater) return;
            }
            const divConfig = divisions.find(d => d.name === t.division)!;
            const now2 = Math.floor(Date.now() / 1000);
            const pool = await calcDivisionPool(divConfig.tier);
            await db.run(
                'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt, maxPlayers) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [t.division, 'registration', now2, now2 + REGISTRATION_WINDOW, pool, new Date().toISOString(), MAX_PLAYERS]
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Создание турнира (если нет активного)
// ---------------------------------------------------------------------------

export async function getOrCreateTournament(type?: string) {
    const now = Math.floor(Date.now() / 1000);

    // Ищем активные турниры по каждому дивизиону (только official)
    const activeByDivision: Record<string, any> = {};
    const activeTournaments = await db.query(
        `SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') AND type = 'official' ORDER BY id DESC`,
        []
    ) as any[];

    for (const t of activeTournaments) {
        if (!activeByDivision[t.division]) {
            activeByDivision[t.division] = t;
        }
    }

    // Для дивизионов без активного турнира — создаём новый official с 30-мин окном
    // Каждый дивизион создаётся в ОТДЕЛЬНОЙ транзакции чтобы избежать гонки
    for (const div of divisions) {
        if (!activeByDivision[div.name]) {
            // Проверяем: есть ли игроки в этом дивизионе
            const playerCount = (await db.one(
                'SELECT COUNT(*) as cnt FROM users WHERE id > 0 AND level >= ? AND level <= ?',
                [div.minLevel, div.maxLevel]
            ) as any).cnt;
            if (playerCount === 0) continue;

            // Проверяем: когда завершился последний турнир этого дивизиона
            const lastCompleted = await db.one(
                "SELECT completedAt FROM tournaments WHERE division = ? AND type = 'official' AND status IN ('completed', 'cancelled') ORDER BY id DESC LIMIT 1",
                [div.name]
            ) as any;
            if (lastCompleted?.completedAt) {
                const ts = typeof lastCompleted.completedAt === 'number' ? lastCompleted.completedAt * 1000
                  : Number(lastCompleted.completedAt) || new Date(lastCompleted.completedAt).getTime();
                if (Date.now() < ts + 14400 * 1000) continue;
            }

            const pool = await calcDivisionPool(div.tier);

            // Транзакция: проверка + вставка атомарно
            try {
                await db.tx(async (client) => {
                    const recheck = (await client.query(
                        `SELECT id FROM tournaments WHERE division = $1 AND status IN ('registration', 'in_progress') AND type = 'official' FOR UPDATE`,
                        [div.name]
                    )).rows[0];
                    if (recheck) return; // уже создан в другой горутине

                    await client.query(
                        'INSERT INTO tournaments (division, status, registrationstart, registrationend, prizepool, createdat, type, maxplayers) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                        [div.name, 'registration', now, now + REGISTRATION_WINDOW, pool, new Date().toISOString(), 'official', MAX_PLAYERS]
                    );
                });
            } catch {} // если транзакция упала — уже создан
        }
    }

    const query = "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ORDER BY id DESC";
    return await db.query(query, []) as any[];
}

// ---------------------------------------------------------------------------
// Роуты
// ---------------------------------------------------------------------------

// Статус турнира
router.get('/tournament', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT level FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const tab = (req.query.tab as string) || 'active';

    if (tab === 'completed') {
        // Завершённые турниры с пагинацией
        const page = parseInt(req.query.page as string) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const total = (await db.one(`
            SELECT COUNT(*) as cnt FROM tournaments t 
            WHERE t.status = 'completed' 
            AND (SELECT COUNT(*) FROM tournament_participants WHERE tournamentId = t.id) >= 2
        `, []) as any).cnt;

        const completed = await db.query(`
            SELECT t.*, (SELECT COUNT(*) FROM tournament_participants WHERE tournamentId = t.id) as participantCount
            FROM tournaments t 
            WHERE t.status = 'completed' 
            AND (SELECT COUNT(*) FROM tournament_participants WHERE tournamentId = t.id) >= 2
            ORDER BY COALESCE(t.completedAt, t.createdAt) DESC LIMIT ? OFFSET ?
        `, [limit, offset]) as any[];

        const result = await Promise.all(completed.map(async (t) => {
            const participants = await db.query(
                'SELECT u.username, g.name as guildName, u.guildId, tp.* FROM tournament_participants tp JOIN users u ON tp.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id WHERE tp.tournamentId = ?',
                [t.id]
            ) as any[];
            const matches = await db.query(
                    'SELECT * FROM tournament_matches WHERE tournamentId = ? ORDER BY round, id',
                    [t.id]
                ) as any[];
                const matchesWithNames = await Promise.all(matches.map(async (m: any) => ({
                    ...m,
                    player1Name: m.player1Id ? (await db.one('SELECT username FROM users WHERE id = ?', [m.player1Id]) as any)?.username : null,
                    player2Name: m.player2Id ? (await db.one('SELECT username FROM users WHERE id = ?', [m.player2Id]) as any)?.username : null,
                    winnerName: m.winnerId ? (await db.one('SELECT username FROM users WHERE id = ?', [m.winnerId]) as any)?.username : null,
                    log: m.log ? (() => { try { return JSON.parse(m.log); } catch { return m.log; } })() : null,
                })));
                return {
                ...t,
                createdAt: typeof t.createdAt === 'string' && /^\d+$/.test(t.createdAt) ? Number(t.createdAt) : (t.createdAt ? Math.floor(new Date(t.createdAt).getTime() / 1000) : 0),
                completedAt: Number(t.completedAt) || t.completedAt,
                registrationEnd: Number(t.registrationEnd) || t.registrationEnd,
                participantCount: participants.length,
                matches: matchesWithNames,
            maxPlayers: t.maxPlayers || MAX_PLAYERS,
                participants: participants.map((p) => ({
                    id: p.userId, username: p.username, goldenTicket: p.goldenTicket,
                    guildName: p.guildName, guildId: p.guildId,
                    snapshotStats: p.snapshotStats ? JSON.parse(p.snapshotStats) : null,
                })),
                top3: participants
                    .filter((p: any) => p.snapshotStats)
                    .map((p) => ({ ...JSON.parse(p.snapshotStats), username: p.username }))
                    .sort((a: any, b: any) => a.place - b.place),
            };
        }));

        return res.json({ tournaments: result, total, page, totalPages: Math.ceil(total / limit), userLevel: user.level, tab: 'completed' });
    }

    // Активные турниры — сначала автопродвижение, потом создание новых
    const allForAdvance = await db.query(
        "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ORDER BY id DESC",
        []
    ) as any[];
    for (const t of allForAdvance) {
        await autoAdvance(t.id);
    }
    const tournaments = await getOrCreateTournament();
    const typeFilter = (req.query.type as string) || 'all';
    let typeCondition = '';
    const typeParams: any[] = [];
    if (typeFilter === 'official') { typeCondition = "AND type = 'official'"; }
    else if (typeFilter === 'custom') { typeCondition = "AND type = 'custom'"; }

    const updated = await db.query(
        `SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ${typeCondition} ORDER BY id DESC`,
        typeParams
    ) as any[];

    const allTournaments = [...updated];

    const result = await Promise.all(allTournaments.map(async (t) => {
        const participants = await db.query(
            'SELECT u.username, g.name as guildName, u.guildId, tp.* FROM tournament_participants tp JOIN users u ON tp.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id WHERE tp.tournamentId = ?',
            [t.id]
        ) as any[];
        const myReg = participants.find((p: any) => p.userId === userId);
        const matches = await db.query(
            'SELECT * FROM tournament_matches WHERE tournamentId = ? ORDER BY round, id',
            [t.id]
        ) as any[];

        return {
            ...t,
            divisionLabel: t.type === 'official' ? (divisions.find(x => x.name === t.division)?.label || t.division) : t.division,
            minLevel: t.type === 'official' ? (() => { const d = divisions.find(x => x.name === t.division); return d?.minLevel; })() : t.minLevel,
            maxLevel: t.type === 'official' ? (() => { const d = divisions.find(x => x.name === t.division); return d?.maxLevel; })() : t.maxLevel,
            participantCount: participants.length,
            maxPlayers: t.maxPlayers || MAX_PLAYERS,
            participants: participants.map((p) => ({
                id: p.userId,
                username: p.username,
                goldenTicket: p.goldenTicket,
                guildName: p.guildName, guildId: p.guildId,
                snapshotStats: p.snapshotStats ? JSON.parse(p.snapshotStats) : null,
            })),
            myRegistration: myReg || null,
            matches: await Promise.all(matches.map(async (m) => ({
                ...m,
                player1Name: m.player1Id
                    ? (await db.one('SELECT username FROM users WHERE id = ?', [m.player1Id]) as any)?.username
                    : null,
                player2Name: m.player2Id
                    ? (await db.one('SELECT username FROM users WHERE id = ?', [m.player2Id]) as any)?.username
                    : null,
                winnerName: m.winnerId
                    ? (await db.one('SELECT username FROM users WHERE id = ?', [m.winnerId]) as any)?.username
                    : null,
                log: m.log ? JSON.parse(m.log) : null,
            }))),
        };
    }));

    // Сортировка: сначала доступные игроку, затем по registrationEnd
    result.sort((a: any, b: any) => {
        const aCanJoin = a.type === 'official'
            ? (() => { const d = divisions.find(x => x.name === a.division); return d ? user.level >= d.minLevel && user.level <= d.maxLevel : false; })()
            : (user.level >= (a.minLevel || 1) && user.level <= (a.maxLevel || 999));
        const bCanJoin = b.type === 'official'
            ? (() => { const d = divisions.find(x => x.name === b.division); return d ? user.level >= d.minLevel && user.level <= d.maxLevel : false; })()
            : (user.level >= (b.minLevel || 1) && user.level <= (b.maxLevel || 999));
        if (aCanJoin && !bCanJoin) return -1;
        if (!aCanJoin && bCanJoin) return 1;
        return a.registrationEnd - b.registrationEnd;
    });

    // Предстоящие официальные турниры (ждём час после завершения)
    const upcomingOfficial: any[] = [];
    for (const div of divisions) {
        const hasActive = await db.one(
            "SELECT id FROM tournaments WHERE division = ? AND status IN ('registration', 'in_progress') AND type = 'official'",
            [div.name]
        );
        if (hasActive) continue;
        const lastCompleted = await db.one(
            "SELECT completedAt FROM tournaments WHERE division = ? AND type = 'official' AND status IN ('completed', 'cancelled') ORDER BY id DESC LIMIT 1",
            [div.name]
        ) as any;
        if (lastCompleted?.completedAt) {
            const ts = typeof lastCompleted.completedAt === 'number' ? lastCompleted.completedAt * 1000
              : Number(lastCompleted.completedAt) || new Date(lastCompleted.completedAt).getTime();
            const registrationOpensAt = ts + 14400 * 1000;
            if (Date.now() < registrationOpensAt) {
                upcomingOfficial.push({
                    division: div.name,
                    label: div.label,
                    icon: div.icon,
                    minLevel: div.minLevel,
                    maxLevel: div.maxLevel,
                    registrationOpensAt: Math.floor(registrationOpensAt / 1000),
                });
            }
        }
    }

    res.json({ tournaments: result, userLevel: user.level, tab: 'active', typeFilter,
        upcomingOfficial
    });
});

// Регистрация
router.post('/tournament/register', async (req, res) => {
    const userId = req.userId;
    const { division, goldenTicket } = req.body;

    const user = await db.one('SELECT level, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    let tournament: any;
    if (division) {
        // Официальный турнир по дивизиону
        const div = divisions.find(d => d.name === division);
        if (!div) return res.status(400).json({ error: 'Неизвестный дивизион' });
        if (user.level < div.minLevel || user.level > div.maxLevel) {
            return res.status(400).json({ error: `Ваш уровень не подходит для дивизиона «${div.label}»` });
        }
        tournament = await db.one(
            "SELECT * FROM tournaments WHERE division = ? AND status = 'registration' AND type = 'official'",
            [division]
        ) as any;
    } else {
        // Кастомный турнир по ID
        const tournamentId = req.body.tournamentId;
        if (!tournamentId) return res.status(400).json({ error: 'Укажите tournamentId или division' });
        tournament = await db.one(
            "SELECT * FROM tournaments WHERE id = ? AND status = 'registration'",
            [tournamentId]
        ) as any;
        if (!tournament) return res.status(400).json({ error: 'Турнир не найден или регистрация закрыта' });

        // Проверка уровня
        if (user.level < (tournament.minLevel || 1) || user.level > (tournament.maxLevel || 999)) {
            return res.status(400).json({ error: `Ваш уровень не подходит (нужен ${tournament.minLevel}–${tournament.maxLevel})` });
        }

        // Вступительный взнос
        if ((tournament.entryFee || 0) > 0) {
            if (user.money < tournament.entryFee) {
                return res.status(400).json({ error: `Недостаточно серебра для взноса (${tournament.entryFee})` });
            }
            await db.run('UPDATE users SET money = money - ? WHERE id = ?', [tournament.entryFee, userId]);
            await db.run('UPDATE tournaments SET prizePool = prizePool + ? WHERE id = ?', [tournament.entryFee, tournament.id]);
        }
    }

    if (!tournament) return res.status(400).json({ error: 'Регистрация закрыта' });

    const existing = await db.one(
        'SELECT id FROM tournament_participants WHERE tournamentId = ? AND userId = ?',
        [tournament.id, userId]
    ) as any;
    if (existing) return res.status(400).json({ error: 'Вы уже зарегистрированы' });

    // Проверка лимита игроков (8 для official, переменный для custom)
    const maxPlayers = tournament.type === 'custom' ? (tournament.maxPlayers || 8) : MAX_PLAYERS;
    const currentCount = (await db.one(
        'SELECT COUNT(*) as cnt FROM tournament_participants WHERE tournamentId = ?',
        [tournament.id]
    ) as any).cnt;
    if (currentCount >= maxPlayers) return res.status(400).json({ error: 'Турнир заполнен' });

    if (goldenTicket && tournament.type === 'official') {
        if (user.money < 1000) return res.status(400).json({ error: 'Недостаточно монет для Золотого билета (1000)' });
        await db.run('UPDATE users SET money = money - 1000 WHERE id = ?', [userId]);
        await db.run('UPDATE tournaments SET prizePool = prizePool + 800 WHERE id = ?', [tournament.id]);
    }

    await db.run('INSERT INTO tournament_participants (tournamentId, userId, goldenTicket) VALUES (?, ?, ?)',
        [tournament.id, userId, goldenTicket ? 1 : 0]);

    await db.run('UPDATE users SET tournamentCount = tournamentCount + 1 WHERE id = ?', [userId]);

    // Автостарт при заполнении
    const count = (await db.one(
        'SELECT COUNT(*) as cnt FROM tournament_participants WHERE tournamentId = ?',
        [tournament.id]
    ) as any).cnt;
    if (count >= maxPlayers) {
        await db.run('UPDATE tournaments SET status = ? WHERE id = ?', ['in_progress', tournament.id]);
        await generateBracket(tournament.id);
        let tt = await db.one('SELECT * FROM tournaments WHERE id = ?', [tournament.id]) as any;
        while (tt && tt.status === 'in_progress') {
            const resolvedRound = await resolveCurrentRound(tt.id);
            if (resolvedRound > 0) {
                await advanceWinners(tt.id, resolvedRound);
                tt = await db.one('SELECT * FROM tournaments WHERE id = ?', [tt.id]) as any;
            } else break;
        }
        res.json({ success: true, started: true });
        return;
    }

    res.json({ success: true });
});

// Создание самоорганизованного турнира
router.post('/tournament/create-custom', async (req, res) => {
    const userId = req.userId;
    const prizePool = parseInt(req.body.prizePool) || 0;
    const entryFee = parseInt(req.body.entryFee) || 0;
    const registrationMinutes = parseInt(req.body.registrationMinutes) || 30;
    const maxPlayers = parseInt(req.body.maxPlayers) || 8;
    const minLevel = parseInt(req.body.minLevel) || 1;
    const maxLevel = parseInt(req.body.maxLevel) || 999;
    const name = (req.body.name || '').trim() || 'Турнир';

    if (prizePool < 0) return res.status(400).json({ error: 'Призовой фонд не может быть отрицательным' });
    if (entryFee < 0) return res.status(400).json({ error: 'Вступительный взнос не может быть отрицательным' });
    const regMins = Math.max(5, Math.min(120, registrationMinutes));
    const players = Math.max(2, Math.min(16, maxPlayers));
    const minLvl = Math.max(1, minLevel);
    const maxLvl = Math.min(999, maxLevel);
    if (minLvl > maxLvl) return res.status(400).json({ error: 'Минимальный уровень больше максимального' });

    const user = await db.one('SELECT level, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const regEnd = now + regMins * 60;

    if (prizePool > 0) {
        if (user.money < prizePool) return res.status(400).json({ error: 'Недостаточно серебра для призового фонда' });
        await db.run('UPDATE users SET money = money - ? WHERE id = ?', [prizePool, userId]);
    }

    // Создатель тоже платит входной взнос (если есть)
    if (entryFee > 0) {
        if (user.money < entryFee) return res.status(400).json({ error: 'Недостаточно серебра для входного взноса' });
        await db.run('UPDATE users SET money = money - ? WHERE id = ?', [entryFee, userId]);
    }

    let result: any;
    try {
        result = await db.run(
            'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt, type, creatorId, entryFee, name, minLevel, maxLevel, basePool, maxPlayers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['custom', 'registration', now, regEnd, prizePool + entryFee, new Date().toISOString(), 'custom', userId, entryFee, name, minLvl, maxLvl, prizePool, players]
        );
    } catch (e: any) {
        return res.status(500).json({ error: 'Ошибка создания турнира: ' + e.message });
    }

    // Авто-регистрация создателя
    await db.run('INSERT INTO tournament_participants (tournamentId, userId, goldenTicket) VALUES (?, ?, ?)',
        [result.lastInsertRowid, userId, 0]);
    await db.run('UPDATE users SET tournamentCount = tournamentCount + 1 WHERE id = ?', [userId]);
    broadcast('tournamentCreated', { tournamentId: result.lastInsertRowid, name });
    res.json({ success: true, tournamentId: result.lastInsertRowid });
});

export default router;
