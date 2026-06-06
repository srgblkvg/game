import { Router } from 'express';
import db from '../database';
import { runBattle } from '../game/battle';
import { getBaseStats, enrichEquipment, addMoney } from '../db/helpers';
import { currentStats } from '../game/stats';

const router = Router();

const MAX_PLAYERS = 8;
const REGISTRATION_WINDOW = 30 * 60; // 30 минут

const divisions = [
    { name: 'copper', label: 'Медный', minLevel: 1, maxLevel: 15, basePool: 500, icon: '🥉' },
    { name: 'steel', label: 'Стальной', minLevel: 16, maxLevel: 35, basePool: 2000, icon: '🥈' },
    { name: 'mithril', label: 'Мифриловый', minLevel: 36, maxLevel: 60, basePool: 8000, icon: '🥇' },
    { name: 'adamant', label: 'Адамантовый', minLevel: 61, maxLevel: 999, basePool: 25000, icon: '👑' },
];

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
function generateBracket(tournamentId: number) {
    const participants = db.prepare(`
        SELECT tp.*, u.username, u.level, u.money, u.baseS, u.baseA, u.baseD, u.baseM,
               u.equipment, u.currentHp, u.statPoints, u.tournamentElo
        FROM tournament_participants tp
        JOIN users u ON tp.userId = u.id
        WHERE tp.tournamentId = ?
        ORDER BY u.tournamentElo ASC
    `).all(tournamentId) as any[];

    if (participants.length < 2) {
        // Отмена — возврат денег для custom турниров
        const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
        if (t && t.type === 'custom') {
            // Возврат базового призового фонда создателю
            if ((t.basePool || 0) > 0) {
                db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(t.basePool, t.creatorId);
            }
            // Возврат входных взносов всем участникам
            if ((t.entryFee || 0) > 0) {
                const parts = db.prepare(
                    'SELECT userId FROM tournament_participants WHERE tournamentId = ?'
                ).all(tournamentId) as any[];
                for (const p of parts) {
                    db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(t.entryFee, p.userId);
                }
            }
        }
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('cancelled', tournamentId);
        return;
    }

    const n = participants.length;
    const slots = nextPowerOfTwo(n);
    const byes = slots - n;

    // Строим массив: реальные игроки + добивка null до степени 2
    const seeded: (typeof participants[0] | null)[] = [...participants];
    for (let i = 0; i < byes; i++) seeded.push(null);

    const insertMatch = db.prepare(`
        INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId)
        VALUES (?, 1, ?, ?, NULL)
    `);

    const half = slots / 2;
    for (let i = 0; i < half; i++) {
        // Соседние пары: 1-2, 3-4, 5-6...
        const p1 = seeded[i * 2];
        const p2 = seeded[i * 2 + 1];

        const p1Id = p1 ? p1.userId : null;
        const p2Id = p2 ? p2.userId : null;

        if (p1Id === null && p2Id === null) continue;

        insertMatch.run(tournamentId, p1Id, p2Id);

        if (p1Id === null && p2Id !== null) {
            const matchId = (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
            db.prepare('UPDATE tournament_matches SET winnerId = ? WHERE id = ?').run(p2Id, matchId);
        }
        if (p2Id === null && p1Id !== null) {
            const matchId = (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
            db.prepare('UPDATE tournament_matches SET winnerId = ? WHERE id = ?').run(p1Id, matchId);
        }
    }
}

// ---------------------------------------------------------------------------
// Симуляция раунда
// ---------------------------------------------------------------------------

function loadPlayerForBattle(userId: number) {
    const u = db.prepare(`
        SELECT id, username, level, money, baseS, baseA, baseD, baseM,
               equipment, currentHp
        FROM users WHERE id = ?
    `).get(userId) as any;
    if (!u) return null;

    let equipment: Record<string, any> = {};
    try { equipment = JSON.parse(u.equipment || '{}'); } catch {}

    const { enriched } = enrichEquipment(db, equipment);
    const base = getBaseStats(u);
    const stats = currentStats(base, enriched);

    return {
        id: u.id,
        name: u.username,
        base,
        equipment: enriched,
        level: u.level,
        money: u.money || 0,
        currentHp: stats.hp, // всегда полное HP для турнирных боёв
    };
}

/**
 * Разрешить все незавершённые матчи текущего раунда.
 * Возвращает номер разрешённого раунда (или 0 если ничего не сделано).
 */
function resolveCurrentRound(tournamentId: number): number {
    // Находим минимальный раунд с незавершёнными матчами
    const pendingRound = db.prepare(`
        SELECT round FROM tournament_matches
        WHERE tournamentId = ? AND winnerId IS NULL
        ORDER BY round LIMIT 1
    `).get(tournamentId) as any;

    if (!pendingRound) return 0;

    const round = pendingRound.round;
    const matches = db.prepare(`
        SELECT * FROM tournament_matches
        WHERE tournamentId = ? AND round = ? AND winnerId IS NULL
    `).all(tournamentId, round) as any[];

    const updateWinner = db.prepare('UPDATE tournament_matches SET winnerId = ?, log = ? WHERE id = ?');

    for (const match of matches) {
        if (!match.player1Id || !match.player2Id) continue; // bye уже обработан

        const p1 = loadPlayerForBattle(match.player1Id);
        const p2 = loadPlayerForBattle(match.player2Id);
        if (!p1 || !p2) continue;

        const result = runBattle(p1, p2);
        updateWinner.run(result.winnerId, JSON.stringify(result.steps), match.id);
    }

    return round;
}

/**
 * После завершения раунда создать матчи следующего раунда из победителей.
 */
function advanceWinners(tournamentId: number, finishedRound: number) {
    const nextRound = finishedRound + 1;

    const winners = db.prepare(`
        SELECT winnerId FROM tournament_matches
        WHERE tournamentId = ? AND round = ? AND winnerId IS NOT NULL
        ORDER BY id
    `).all(tournamentId, finishedRound) as any[];

    if (winners.length < 2) {
        // Турнир завершён — остался один победитель
        finishTournament(tournamentId);
        return;
    }

    const insertMatch = db.prepare(`
        INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId)
        VALUES (?, ?, ?, ?, NULL)
    `);

    // Соседние пары: 1-2, 3-4...
    const n = winners.length;
    const half = Math.floor(n / 2);
    for (let i = 0; i < half; i++) {
        insertMatch.run(tournamentId, nextRound, winners[i * 2].winnerId, winners[i * 2 + 1].winnerId);
    }
}

// ---------------------------------------------------------------------------
// Завершение турнира и призы
// ---------------------------------------------------------------------------

function finishTournament(tournamentId: number) {
    const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!t || t.status === 'completed' || t.status === 'cancelled') return;

    const prizePool = t.prizePool || 0;

    // Собираем результаты: финал (последний раунд) → 1-е место,
    // проигравший в финале → 2-е место,
    // полуфиналисты → 3-е место (берём того, кто проиграл победителю)
    const lastRound = db.prepare(`
        SELECT MAX(round) as maxRound FROM tournament_matches WHERE tournamentId = ?
    `).get(tournamentId) as any;
    const finalRound = lastRound?.maxRound || 1;

    // Победитель (1-е место) — winnerId последнего матча финала
    const finalMatches = db.prepare(`
        SELECT * FROM tournament_matches WHERE tournamentId = ? AND round = ?
    `).all(tournamentId, finalRound) as any[];

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
        const semiMatches = db.prepare(`
            SELECT * FROM tournament_matches WHERE tournamentId = ? AND round = ?
        `).all(tournamentId, finalRound - 1) as any[];

        for (const sm of semiMatches) {
            if (!sm.winnerId) continue;
            const loser = sm.player1Id === sm.winnerId ? sm.player2Id : sm.player1Id;
            if (loser && loser !== winnerId && loser !== secondPlaceId) {
                thirdPlaceId = loser;
                break;
            }
        }
    }

    // Распределение призов
    const firstPrize = Math.floor(prizePool * 0.5);
    const secondPrize = Math.floor(prizePool * 0.3);
    const thirdPrize = prizePool - firstPrize - secondPrize; // остаток

    if (prizePool > 0) {
        addMoney(db, winnerId, firstPrize);
        if (secondPlaceId) addMoney(db, secondPlaceId, secondPrize);
        if (thirdPlaceId) addMoney(db, thirdPlaceId, thirdPrize);
    }

    // Сохраняем результаты в таблицу tournament_participants
    db.prepare('UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?')
        .run(JSON.stringify({ place: 1, prize: firstPrize }), tournamentId, winnerId);
    db.prepare('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?').run(winnerId);
    if (secondPlaceId) {
        db.prepare('UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?')
            .run(JSON.stringify({ place: 2, prize: secondPrize }), tournamentId, secondPlaceId);
        db.prepare('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?').run(secondPlaceId);
    }
    if (thirdPlaceId) {
        db.prepare('UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?')
            .run(JSON.stringify({ place: 3, prize: thirdPrize }), tournamentId, thirdPlaceId);
        db.prepare('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?').run(thirdPlaceId);
    }

    db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('completed', tournamentId);

    // --- Обновление скрытого tournamentElo для посева ---
    // Победитель +25, 2-е +15, 3-е +10, полуфиналисты +5, остальные 0
    // Проигравшие в первом раунде получают небольшой минус
    const allParts = db.prepare(
        'SELECT userId FROM tournament_participants WHERE tournamentId = ?'
    ).all(tournamentId) as any[];

    for (const p of allParts) {
        let delta = 0;
        if (p.userId === winnerId) delta = 25;
        else if (p.userId === secondPlaceId) delta = 15;
        else if (p.userId === thirdPlaceId) delta = 10;
        else {
            // Проверяем, прошёл ли игрок дальше первого раунда
            const wonInR1 = db.prepare(
                'SELECT id FROM tournament_matches WHERE tournamentId = ? AND round = 1 AND winnerId = ?'
            ).get(tournamentId, p.userId) as any;
            if (wonInR1) delta = 3; // прошёл первый раунд
            else delta = -3;        // вылетел в первом раунде
        }
        db.prepare('UPDATE users SET tournamentElo = MAX(100, tournamentElo + ?) WHERE id = ?')
            .run(delta, p.userId);
    }
}

// ---------------------------------------------------------------------------
// Автопродвижение (вызывается при каждом GET /tournament)
// ---------------------------------------------------------------------------

function autoAdvance(tournamentId: number) {
    const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!t) return;

    const now = Math.floor(Date.now() / 1000);

    if (t.status === 'registration' && now >= t.registrationEnd) {
        // Время регистрации истекло — стартуем (если отменено в generateBracket, создастся новый)
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('in_progress', tournamentId);
        generateBracket(tournamentId);
        autoAdvance(tournamentId);
        return;
    }

    if (t.status === 'in_progress') {
        const resolvedRound = resolveCurrentRound(tournamentId);
        if (resolvedRound > 0) {
            advanceWinners(tournamentId, resolvedRound);
            autoAdvance(tournamentId);
        }
        return;
    }

    // Если турнир завершён или отменён — создаём новый для этого дивизиона (только official)
    if ((t.status === 'completed' || t.status === 'cancelled') && t.type === 'official') {
        const existing = db.prepare(
            "SELECT id FROM tournaments WHERE division = ? AND status IN ('registration', 'in_progress')"
        ).get(t.division) as any;
        if (!existing) {
            const divConfig = divisions.find(d => d.name === t.division)!;
            db.prepare(
                'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(t.division, 'registration', now, now + REGISTRATION_WINDOW, divConfig.basePool, now);
        }
    }
}

// ---------------------------------------------------------------------------
// Создание турнира (если нет активного)
// ---------------------------------------------------------------------------

function getOrCreateTournament(type?: string) {
    const now = Math.floor(Date.now() / 1000);
    const typeFilter = type ? "AND type = ?" : "";
    const params: any[] = type ? [type] : [];

    // Ищем активные турниры по каждому дивизиону (только official)
    const activeByDivision: Record<string, any> = {};
    const activeTournaments = db.prepare(
        `SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') AND type = 'official' ORDER BY id DESC`
    ).all() as any[];

    for (const t of activeTournaments) {
        if (!activeByDivision[t.division]) {
            activeByDivision[t.division] = t;
        }
    }

    // Для дивизионов без активного турнира — создаём новый official с 30-мин окном
    for (const div of divisions) {
        if (!activeByDivision[div.name]) {
            db.prepare(
                'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(div.name, 'registration', now, now + REGISTRATION_WINDOW, div.basePool, now, 'official');
        }
    }

    let query = "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress')";
    if (type) query += " AND type = ?";
    query += " ORDER BY id DESC";
    return db.prepare(query).all(...params) as any[];
}

// ---------------------------------------------------------------------------
// Роуты
// ---------------------------------------------------------------------------

// Статус турнира
router.get('/tournament', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT level FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const tab = (req.query.tab as string) || 'active';

    if (tab === 'completed') {
        // Завершённые турниры с пагинацией
        const page = parseInt(req.query.page as string) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const total = (db.prepare(
            "SELECT COUNT(*) as cnt FROM tournaments WHERE status = 'completed'"
        ).get() as any).cnt;

        const completed = db.prepare(
            "SELECT * FROM tournaments WHERE status = 'completed' ORDER BY id DESC LIMIT ? OFFSET ?"
        ).all(limit, offset) as any[];

        const result = completed.map((t: any) => {
            const participants = db.prepare(
                'SELECT u.username, tp.* FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ?'
            ).all(t.id) as any[];
            return {
                ...t,
                participantCount: participants.length,
                participants: participants.map((p: any) => ({
                    id: p.userId, username: p.username, goldenTicket: p.goldenTicket,
                    snapshotStats: p.snapshotStats ? JSON.parse(p.snapshotStats) : null,
                })),
                top3: participants
                    .filter((p: any) => p.snapshotStats)
                    .map((p: any) => ({ ...JSON.parse(p.snapshotStats), username: p.username }))
                    .sort((a: any, b: any) => a.place - b.place),
            };
        });

        return res.json({ tournaments: result, total, page, totalPages: Math.ceil(total / limit), userLevel: user.level, tab: 'completed' });
    }

    // Активные турниры
    const tournaments = getOrCreateTournament();

    // Автопродвижение
    const allForAdvance = db.prepare(
        "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress', 'completed') AND createdAt > ? ORDER BY id DESC"
    ).all(now - 86400) as any[];
    for (const t of allForAdvance) {
        autoAdvance(t.id);
    }

    // Фильтр по типу: all (по умолчанию), official, custom
    const typeFilter = (req.query.type as string) || 'all';
    let typeCondition = '';
    const typeParams: any[] = [];
    if (typeFilter === 'official') { typeCondition = "AND type = 'official'"; }
    else if (typeFilter === 'custom') { typeCondition = "AND type = 'custom'"; }

    const updated = db.prepare(
        `SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ${typeCondition} ORDER BY id DESC`
    ).all(...typeParams) as any[];

    const allTournaments = [...updated];

    const result = allTournaments.map((t: any) => {
        const participants = db.prepare(
            'SELECT u.username, tp.* FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ?'
        ).all(t.id) as any[];
        const myReg = participants.find((p: any) => p.userId === userId);
        const matches = db.prepare(
            'SELECT * FROM tournament_matches WHERE tournamentId = ? ORDER BY round, id'
        ).all(t.id) as any[];

        return {
            ...t,
            participantCount: participants.length,
            participants: participants.map((p: any) => ({
                id: p.userId,
                username: p.username,
                goldenTicket: p.goldenTicket,
                snapshotStats: p.snapshotStats ? JSON.parse(p.snapshotStats) : null,
            })),
            myRegistration: myReg || null,
            matches: matches.map((m: any) => ({
                ...m,
                player1Name: m.player1Id
                    ? (db.prepare('SELECT username FROM users WHERE id = ?').get(m.player1Id) as any)?.username
                    : null,
                player2Name: m.player2Id
                    ? (db.prepare('SELECT username FROM users WHERE id = ?').get(m.player2Id) as any)?.username
                    : null,
                winnerName: m.winnerId
                    ? (db.prepare('SELECT username FROM users WHERE id = ?').get(m.winnerId) as any)?.username
                    : null,
                log: m.log ? JSON.parse(m.log) : null,
            })),
        };
    });

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

    res.json({ tournaments: result, userLevel: user.level, tab: 'active', typeFilter });
});

// Регистрация
router.post('/tournament/register', (req: any, res) => {
    const userId = req.userId;
    const { division, goldenTicket } = req.body;

    const user = db.prepare('SELECT level, money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    let tournament: any;
    if (division) {
        // Официальный турнир по дивизиону
        const div = divisions.find(d => d.name === division);
        if (!div) return res.status(400).json({ error: 'Неизвестный дивизион' });
        if (user.level < div.minLevel || user.level > div.maxLevel) {
            return res.status(400).json({ error: `Ваш уровень не подходит для дивизиона «${div.label}»` });
        }
        tournament = db.prepare(
            "SELECT * FROM tournaments WHERE division = ? AND status = 'registration' AND type = 'official'"
        ).get(division) as any;
    } else {
        // Кастомный турнир по ID
        const tournamentId = req.body.tournamentId;
        if (!tournamentId) return res.status(400).json({ error: 'Укажите tournamentId или division' });
        tournament = db.prepare(
            "SELECT * FROM tournaments WHERE id = ? AND status = 'registration' AND type = 'custom'"
        ).get(tournamentId) as any;
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
            db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(tournament.entryFee, userId);
            db.prepare('UPDATE tournaments SET prizePool = prizePool + ? WHERE id = ?').run(tournament.entryFee, tournament.id);
        }
    }

    if (!tournament) return res.status(400).json({ error: 'Регистрация закрыта' });

    const existing = db.prepare(
        'SELECT id FROM tournament_participants WHERE tournamentId = ? AND userId = ?'
    ).get(tournament.id, userId) as any;
    if (existing) return res.status(400).json({ error: 'Вы уже зарегистрированы' });

    // Проверка лимита игроков (8 для official, переменный для custom)
    const maxPlayers = tournament.type === 'custom' ? (tournament.maxPlayers || 8) : MAX_PLAYERS;
    const currentCount = (db.prepare(
        'SELECT COUNT(*) as cnt FROM tournament_participants WHERE tournamentId = ?'
    ).get(tournament.id) as any).cnt;
    if (currentCount >= maxPlayers) return res.status(400).json({ error: 'Турнир заполнен' });

    if (goldenTicket && tournament.type === 'official') {
        if (user.money < 1000) return res.status(400).json({ error: 'Недостаточно монет для Золотого билета (1000)' });
        db.prepare('UPDATE users SET money = money - 1000 WHERE id = ?').run(userId);
        db.prepare('UPDATE tournaments SET prizePool = prizePool + 800 WHERE id = ?').run(tournament.id);
    }

    db.prepare('INSERT INTO tournament_participants (tournamentId, userId, goldenTicket) VALUES (?, ?, ?)')
        .run(tournament.id, userId, goldenTicket ? 1 : 0);

    db.prepare('UPDATE users SET tournamentCount = tournamentCount + 1 WHERE id = ?').run(userId);

    // Автостарт при заполнении
    const count = (db.prepare(
        'SELECT COUNT(*) as cnt FROM tournament_participants WHERE tournamentId = ?'
    ).get(tournament.id) as any).cnt;
    if (count >= maxPlayers) {
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('in_progress', tournament.id);
        generateBracket(tournament.id);
        let tt = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament.id) as any;
        while (tt && tt.status === 'in_progress') {
            const resolvedRound = resolveCurrentRound(tt.id);
            if (resolvedRound > 0) {
                advanceWinners(tt.id, resolvedRound);
                tt = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tt.id) as any;
            } else break;
        }
        res.json({ success: true, started: true });
        return;
    }

    res.json({ success: true });
});

// Создание самоорганизованного турнира
router.post('/tournament/create-custom', (req: any, res) => {
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

    const user = db.prepare('SELECT level, money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const regEnd = now + regMins * 60;

    if (prizePool > 0) {
        if (user.money < prizePool) return res.status(400).json({ error: 'Недостаточно серебра для призового фонда' });
        db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(prizePool, userId);
    }

    // Создатель тоже платит входной взнос (если есть)
    if (entryFee > 0) {
        if (user.money < entryFee) return res.status(400).json({ error: 'Недостаточно серебра для входного взноса' });
        db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(entryFee, userId);
    }

    let result: any;
    try {
        result = db.prepare(
            'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt, type, creatorId, entryFee, name, minLevel, maxLevel, basePool) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run('custom', 'registration', now, regEnd, prizePool + entryFee, now, 'custom', userId, entryFee, name, minLvl, maxLvl, prizePool);
    } catch (e: any) {
        return res.status(500).json({ error: 'Ошибка создания турнира: ' + e.message });
    }

    // Авто-регистрация создателя
    db.prepare('INSERT INTO tournament_participants (tournamentId, userId, goldenTicket) VALUES (?, ?, ?)')
        .run(result.lastInsertRowid, userId, 0);
    db.prepare('UPDATE users SET tournamentCount = tournamentCount + 1 WHERE id = ?').run(userId);
    res.json({ success: true, tournamentId: result.lastInsertRowid });
});

export default router;
