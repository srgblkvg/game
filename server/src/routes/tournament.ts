import { Router } from 'express';
import db from '../database';
import { runBattle } from '../game/battle';
import { getBaseStats, enrichEquipment, addMoney } from '../db/helpers';
import { currentStats } from '../game/stats';

const router = Router();

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
               u.equipment, u.currentHp, u.statPoints
        FROM tournament_participants tp
        JOIN users u ON tp.userId = u.id
        WHERE tp.tournamentId = ?
        ORDER BY tp.goldenTicket DESC, tp.userId
    `).all(tournamentId) as any[];

    if (participants.length < 2) {
        // Недостаточно участников — отменяем турнир
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('cancelled', tournamentId);
        return;
    }

    const n = participants.length;
    const slots = nextPowerOfTwo(n);
    const byes = slots - n;

    // Строим посев: первые N — реальные игроки, остальные — bye (null)
    const seeded: (typeof participants[0] | null)[] = [...participants];
    for (let i = 0; i < byes; i++) seeded.push(null);

    const insertMatch = db.prepare(`
        INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId)
        VALUES (?, 1, ?, ?, NULL)
    `);

    const half = slots / 2;
    for (let i = 0; i < half; i++) {
        const p1 = seeded[i];
        const p2 = seeded[slots - 1 - i];

        const p1Id = p1 ? p1.userId : null;
        const p2Id = p2 ? p2.userId : null;

        // Если оба null — странно, но пропускаем
        if (p1Id === null && p2Id === null) continue;

        insertMatch.run(tournamentId, p1Id, p2Id);

        // Если один из игроков bye — сразу засчитываем победу второму
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

    // Стандартная пара: 1-й с последним, 2-й с предпоследним...
    const n = winners.length;
    const half = n / 2;
    for (let i = 0; i < half; i++) {
        insertMatch.run(tournamentId, nextRound, winners[i].winnerId, winners[n - 1 - i].winnerId);
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
}

// ---------------------------------------------------------------------------
// Автопродвижение (вызывается при каждом GET /tournament)
// ---------------------------------------------------------------------------

function autoAdvance(tournamentId: number) {
    const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!t) return;

    const now = Math.floor(Date.now() / 1000);

    if (t.status === 'registration' && now >= t.registrationEnd) {
        // Регистрация закончилась — стартуем
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('in_progress', tournamentId);
        generateBracket(tournamentId);
        // После генерации бай-инов некоторые матчи могут быть уже решены
        // Пытаемся продвинуть дальше
        autoAdvance(tournamentId);
        return;
    }

    if (t.status === 'in_progress') {
        // Разрешаем текущий раунд
        const resolvedRound = resolveCurrentRound(tournamentId);
        if (resolvedRound > 0) {
            advanceWinners(tournamentId, resolvedRound);
            // Рекурсивно продолжаем, если есть ещё раунды
            autoAdvance(tournamentId);
        }
    }
}

// ---------------------------------------------------------------------------
// Создание турнира (если нет активного)
// ---------------------------------------------------------------------------

function getOrCreateTournament() {
    const now = Math.floor(Date.now() / 1000);
    // Ищем активные турниры (registration, in_progress) + будущие
    let tournaments = db.prepare(
        "SELECT * FROM tournaments WHERE (registrationEnd > ? OR status IN ('registration', 'in_progress')) AND status != ? ORDER BY id DESC"
    ).all(now, 'cancelled') as any[];

    if (tournaments.length === 0) {
        const day = new Date().getDay();
        const daysUntilSunday = day === 0 ? 7 : 7 - day;
        const nextSunday = new Date();
        nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
        nextSunday.setHours(13, 0, 0, 0);
        const regEnd = Math.floor(nextSunday.getTime() / 1000);
        const regStart = regEnd - 37 * 3600;

        const stmt = db.prepare(
            'INSERT INTO tournaments (division, status, registrationStart, registrationEnd, prizePool, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const div of divisions) {
            stmt.run(div.name, 'registration', regStart, regEnd, div.basePool, now);
        }
        tournaments = db.prepare(
            "SELECT * FROM tournaments WHERE (registrationEnd > ? OR status IN ('registration', 'in_progress')) AND status != ? ORDER BY id DESC"
        ).all(now, 'cancelled') as any[];
    }

    return tournaments;
}

// ---------------------------------------------------------------------------
// Роуты
// ---------------------------------------------------------------------------

// Статус турнира
router.get('/tournament', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT level FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tournaments = getOrCreateTournament();

    // Автопродвижение для всех активных турниров
    for (const t of tournaments) {
        autoAdvance(t.id);
    }

    // Перезагружаем после автопродвижения
    const now = Math.floor(Date.now() / 1000);
    const updated = db.prepare(
        "SELECT * FROM tournaments WHERE (registrationEnd > ? OR status IN ('registration', 'in_progress')) AND status != ? ORDER BY id DESC"
    ).all(now, 'cancelled') as any[];

    // Добавляем completed турниры за последние 7 дней
    const weekAgo = now - 7 * 86400;
    const recentCompleted = db.prepare(
        'SELECT * FROM tournaments WHERE status = ? AND createdAt > ? ORDER BY id DESC'
    ).all('completed', weekAgo) as any[];

    const allTournaments = [...updated, ...recentCompleted];

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

    res.json({ tournaments: result, userLevel: user.level });
});

// Регистрация
router.post('/tournament/register', (req: any, res) => {
    const userId = req.userId;
    const { division, goldenTicket } = req.body;

    const user = db.prepare('SELECT level, money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const div = divisions.find(d => d.name === division);
    if (!div) return res.status(400).json({ error: 'Неизвестный дивизион' });
    if (user.level < div.minLevel || user.level > div.maxLevel) {
        return res.status(400).json({ error: `Ваш уровень не подходит для дивизиона «${div.label}»` });
    }

    const tournament = db.prepare(
        'SELECT * FROM tournaments WHERE division = ? AND status = ?'
    ).get(division, 'registration') as any;
    if (!tournament) return res.status(400).json({ error: 'Регистрация закрыта' });

    const existing = db.prepare(
        'SELECT id FROM tournament_participants WHERE tournamentId = ? AND userId = ?'
    ).get(tournament.id, userId) as any;
    if (existing) return res.status(400).json({ error: 'Вы уже зарегистрированы' });

    if (goldenTicket) {
        if (user.money < 1000) return res.status(400).json({ error: 'Недостаточно монет для Золотого билета (1000)' });
        db.prepare('UPDATE users SET money = money - 1000 WHERE id = ?').run(userId);
        db.prepare('UPDATE tournaments SET prizePool = prizePool + 800 WHERE id = ?').run(tournament.id);
    }

    db.prepare('INSERT INTO tournament_participants (tournamentId, userId, goldenTicket) VALUES (?, ?, ?)')
        .run(tournament.id, userId, goldenTicket ? 1 : 0);

    // Инкремент счётчика участий в турнирах
    db.prepare('UPDATE users SET tournamentCount = tournamentCount + 1 WHERE id = ?').run(userId);

    res.json({ success: true });
});

export default router;
