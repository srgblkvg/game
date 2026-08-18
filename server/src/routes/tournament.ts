import { Router } from 'express';
import { db, pool } from '../db/index';
import { runBattle } from '../game/battle';
import { getBaseStats, enrichEquipment, addMoney, getCollectionBonus, buildPlayerStats, buildCombatPowerStats } from '../db/helpers';
import { currentStats } from '../game/stats';
import { createTournamentSnapshot, formatTournamentNormalizationLog, mergeTournamentResult, normalizeTournamentGroup, parseTournamentSnapshot, playerFromTournamentSnapshot } from '../game/tournamentSnapshot';
import { calculateCombatPower } from '../game/combatPower';
import { getRegistrationWindowForNewQueue } from '../game/tournamentCycle';
import { calculateTournamentRewards, getThirdPlacePair } from '../game/tournamentRewards';
import { presentCompletedTournamentTop3 } from '../game/tournamentPresentation';
import { applyDivisionChampionship, assignTournamentDivision, getTournamentDivision, getTournamentDivisionByIndex, TOURNAMENT_DIVISIONS } from '../game/tournamentDivision';
import { allocateDivisionPrizePools, splitParticipantsByDivision } from '../game/tournamentDivisionQueue';
import { initTournamentSchema, isTournamentSchemaReady } from '../game/tournamentSchema';
import { runTournamentGroupStage, type GroupFightMetadata } from '../game/tournamentGroupRunner';
import { createFixedPlayoffPairs, createRoundRobinMatches, drawTournamentGroups, getGroupQualificationState } from '../game/tournamentGroupStage';
import { allocateMergedPrizePools, getPowerDivision, getPowerDivisionByNumber, getPowerPrizeWeight, mergeAllTournamentQueues, selectReadyQueueWindow } from '../game/tournamentQueue';
import { broadcast } from '../events';
import { getDrinkBonuses } from '../game/drinks';
import { checkAchievement } from './achievements';

const router = Router();

router.use(async (_req, res, next) => {
    try {
        if (!isTournamentSchemaReady()) await initTournamentSchema();
        next();
    } catch {
        res.status(503).json({ error: 'Турнирная система временно недоступна: не применена миграция базы данных' });
    }
});

const MAX_PLAYERS = 8;
const REGISTRATION_WINDOW = 60 * 60; // 1 час
const OFFICIAL_MERGE_WAIT = 5 * 60; // до 5 минут ждём соседние группы
const OFFICIAL_INTERVAL = 7 * 60 * 60; // следующий общий набор через 7 часов после завершения

const divisions: Array<{ name: string; label: string; tier: number; minPower: number; maxPower: number; icon: string }> = [];
const TIERS_TOTAL = 55; // 1+2+3+4+5+6+7+8+9+10

function timestampMs(value: any): number {
    if (!value) return 0;
    return typeof value === 'number' ? value * 1000 : Number(value) || new Date(value).getTime();
}

async function getNextOfficialRegistrationAt(): Promise<number | null> {
    const now = Math.floor(Date.now() / 1000);
    const future = await db.one(
        `SELECT registrationStart FROM tournaments
         WHERE type = 'official' AND status = 'registration' AND registrationStart > ?
         ORDER BY registrationStart LIMIT 1`, [now]
    ) as any;
    if (future?.registrationStart) return Number(future.registrationStart);
    const active = await db.one(
        `SELECT id FROM tournaments
         WHERE type = 'official' AND status IN ('registration', 'in_progress')
           AND (status = 'in_progress' OR registrationStart <= ?)
         LIMIT 1`, [now]
    ) as any;
    if (active) return null;
    const last = await db.one(
        `SELECT completedAt FROM tournaments
         WHERE type = 'official' AND status IN ('completed', 'cancelled') AND completedAt IS NOT NULL
         ORDER BY completedAt DESC LIMIT 1`, []
    ) as any;
    const completedMs = timestampMs(last?.completedAt);
    if (!completedMs) return null;
    const opensAt = Math.floor(completedMs / 1000) + OFFICIAL_INTERVAL;
    return opensAt > now ? opensAt : null;
}

function parseJsonValue(value: unknown): any {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch { return null; }
}

// Расчёт призового фонда дивизиона: 10% казны * tier / TIERS_TOTAL
async function calcDivisionPool(tier: number): Promise<number> {
    try {
        const { getTreasury } = await import('../game/treasury');
        const treasury = await getTreasury();
        const share = Math.floor(treasury * 0.1);
        return Math.floor(share * tier / TIERS_TOTAL);
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
 * Участники сортируются по tournamentElo, затем userId.
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
        `SELECT tp.userid, u.tournamentelo FROM tournament_participants tp JOIN users u ON tp.userid = u.id WHERE tp.tournamentid = $1 ORDER BY u.tournamentelo DESC`,
        [tournamentId]
    );
    const participants = partRows.rows;
    const getUserId = (p: any) => p ? p.userid : null;

    console.log(`[bracket] tid=${tournamentId} participants=${participants.length}`);
    if (participants.length < 2) {
        console.log(`[bracket] tid=${tournamentId} SKIP < 2`);
        // Отмена
        const t = await db.one('SELECT * FROM tournaments WHERE id = ?', [tournamentId]) as any;
        if (t) {
            if (t.type === 'custom') {
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
            } else {
                // official: возврат basePool в казну, взносы — игрокам
                if ((t.basePool || 0) > 0) {
                    const { addToTreasury } = await import('../game/treasury');
                    await addToTreasury(t.basePool, 'tournament_cancel_official');
                }
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
    const collCnt = await getCollectionBonus(userId);
    const drinkBonuses = getDrinkBonuses(u);
    const { getGuildBonus } = await import('../game/guildBuildings');
    const guildBonus = await getGuildBonus(userId, 'tournament');
    const stats = currentStats(base, enriched, drinkBonuses, collCnt, guildBonus);

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
        guildBonus,
    };
}

async function loadPlayerForBattleTx(client: any, userId: number) {
    const uResult = await client.query(`
        SELECT id, username, level, money, bases, basea, based, basem,
               equipment, currenthp, activedrink, drinkuntil
        FROM users WHERE id = $1
    `, [userId]);
    const u = uResult.rows[0];
    if (!u) return null;

    let equipment: Record<string, any> = {};
    try { equipment = JSON.parse(u.equipment || '{}'); } catch {}

    const { enriched } = await enrichEquipment(equipment);
    const base = getBaseStats({ baseS: u.bases, baseA: u.basea, baseD: u.based, baseM: u.basem });
    const collCnt = await getCollectionBonus(userId);
    const drinkBonuses = getDrinkBonuses({ activeDrink: u.activedrink, drinkUntil: u.drinkuntil });
    const { getGuildBonus } = await import('../game/guildBuildings');
    const guildBonus = await getGuildBonus(userId, 'tournament');
    const stats = currentStats(base, enriched, drinkBonuses, collCnt, guildBonus);

    return {
        id: u.id,
        name: u.username,
        base,
        equipment: enriched,
        level: u.level,
        money: u.money || 0,
        currentHp: stats.hp,
        drinkBonuses,
        collectionBonus: collCnt,
        guildBonus,
    };
}

async function saveTournamentResult(tournamentId: number, userId: number, place: number, prize: number) {
    const participant = await db.one(
        'SELECT snapshotStats FROM tournament_participants WHERE tournamentId = ? AND userId = ?',
        [tournamentId, userId]
    ) as any;
    let previous: any = null;
    previous = parseJsonValue(participant?.snapshotStats);
    const snapshot = mergeTournamentResult(previous, place, prize);
    await db.run(
        'UPDATE tournament_participants SET snapshotStats = ? WHERE tournamentId = ? AND userId = ?',
        [JSON.stringify(snapshot), tournamentId, userId]
    );
}

async function saveTournamentResultTx(client: any, tournamentId: number, userId: number, place: number, prize: number) {
    const result = await client.query(
        'SELECT snapshotstats FROM tournament_participants WHERE tournamentid = $1 AND userid = $2',
        [tournamentId, userId]
    );
    const previous = parseJsonValue(result.rows[0]?.snapshotstats);
    const snapshot = mergeTournamentResult(previous, place, prize);
    await client.query(
        'UPDATE tournament_participants SET snapshotstats = $1 WHERE tournamentid = $2 AND userid = $3',
        [JSON.stringify(snapshot), tournamentId, userId]
    );
}

export async function buildTournamentSnapshotForUser(userId: number) {
    const fullUser = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!fullUser) return null;

    const tournamentStats = await buildPlayerStats(fullUser, 'tournament');
    const combatPowerStats = await buildCombatPowerStats(fullUser);
    const activeSlot = fullUser.activeEquipSlot || fullUser.active_equip_slot || 1;
    const parseEquipment = (value: any) => typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
    const equipment = parseEquipment(fullUser[`equipment_${activeSlot}`]);
    const finalEquipment = Object.keys(equipment).length > 0 ? equipment : parseEquipment(fullUser.equipment);
    const scalablePowerStats = currentStats(getBaseStats(fullUser), finalEquipment);
    const collectionBonus = await getCollectionBonus(userId);
    const guildId = Number(fullUser.guildId || fullUser.guildid || 0);

    let guildBonus = 0;
    if (guildId > 0) {
        const { getGuildBonus } = await import('../game/guildBuildings');
        guildBonus = await getGuildBonus(userId, 'tournament');
    }
    const { loadBattleAntiStats } = await import('../game/guildBoss');
    const { playerTalents, guildTalents, antiStats } = await loadBattleAntiStats(userId, guildId);

    const snapshot = createTournamentSnapshot({
        id: fullUser.id,
        name: fullUser.username,
        level: fullUser.level,
        base: getBaseStats(fullUser),
        equipment: finalEquipment,
        stats: tournamentStats,
        combatPowerStats,
        scalablePowerStats,
        drinkBonuses: getDrinkBonuses(fullUser),
        collectionBonus,
        guildBonus,
        activeEquipSlot: activeSlot,
        playerTalents,
        guildTalents,
        antiStats,
    } as any, calculateCombatPower(combatPowerStats, undefined, fullUser.level));
    snapshot.divisionIndex = assignTournamentDivision(
        fullUser.tournamentDivision ?? fullUser.tournament_division,
        snapshot.combatPower,
    );
    return snapshot;
}

async function loadTournamentPlayer(tournamentId: number, userId: number) {
    const participant = await db.one(
        'SELECT snapshotStats FROM tournament_participants WHERE tournamentId = ? AND userId = ?',
        [tournamentId, userId]
    ) as any;
    const snapshot = parseTournamentSnapshot(participant?.snapshotStats);
    return snapshot ? { ...playerFromTournamentSnapshot(snapshot), _tournamentSnapshot: snapshot } : loadPlayerForBattle(userId);
}

async function loadTournamentPlayerTx(client: any, tournamentId: number, userId: number) {
    const result = await client.query(
        'SELECT snapshotstats FROM tournament_participants WHERE tournamentid = $1 AND userid = $2',
        [tournamentId, userId]
    );
    const snapshot = parseTournamentSnapshot(result.rows[0]?.snapshotstats);
    return snapshot ? { ...playerFromTournamentSnapshot(snapshot), _tournamentSnapshot: snapshot } : loadPlayerForBattleTx(client, userId);
}

function tournamentNormalizationStep(first: any, second: any) {
    const firstSnapshot = first?._tournamentSnapshot;
    const secondSnapshot = second?._tournamentSnapshot;
    if (!firstSnapshot || !secondSnapshot || (!firstSnapshot.normalization && !secondSnapshot.normalization)) return null;
    return { type: 'info', message: formatTournamentNormalizationLog(firstSnapshot, secondSnapshot) };
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

        const p1 = await loadTournamentPlayer(tournamentId, match.player1Id);
        const p2 = await loadTournamentPlayer(tournamentId, match.player2Id);
        if (!p1 || !p2) continue;

        const result = runBattle(p1, p2);
        // В турнирах серебро не воруем — убираем money-шаги из лога
        const tourSteps = result.steps.filter((s: any) => s.type !== 'money');
        const normalizationStep = tournamentNormalizationStep(p1, p2);
        if (normalizationStep) tourSteps.unshift(normalizationStep as any);
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

    const matches = await db.query(
        'SELECT round, player1Id, player2Id, winnerId, stage FROM tournament_matches WHERE tournamentId = ?',
        [tournamentId],
    ) as any[];
    const participants = await db.query(
        'SELECT userId FROM tournament_participants WHERE tournamentId = ?',
        [tournamentId],
    ) as any[];
    const rewards = calculateTournamentRewards({
        prizePool,
        participantIds: participants.map(row => Number(row.userId)),
        matches: matches.map(row => ({
            round: Number(row.round),
            player1Id: row.player1Id == null ? null : Number(row.player1Id),
            player2Id: row.player2Id == null ? null : Number(row.player2Id),
            winnerId: row.winnerId == null ? null : Number(row.winnerId),
            stage: row.stage || undefined,
        })),
    });
    if (rewards.length === 0) return;
    const winnerId = rewards[0]!.userId;
    const secondPlaceId = rewards.find(reward => reward.place === 2)?.userId || null;
    const thirdPlaceId = rewards.find(reward => reward.place === 3)?.userId || null;

    for (const reward of rewards) {
        if (reward.prize > 0) await addMoney(reward.userId, reward.prize);
        await saveTournamentResult(tournamentId, reward.userId, reward.place, reward.prize);
    }
    await db.run('UPDATE users SET tournamentWins = tournamentWins + 1 WHERE id = ?', [winnerId]);
    checkAchievement(winnerId, 'tournament').catch(() => {});

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

/**
 * Транзакционная версия finishTournament (использует client вместо db).
 */
async function finishTournamentTx(client: any, tournamentId: number) {
    const tResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    const t = tResult.rows[0];
    if (!t || t.status === 'completed' || t.status === 'cancelled') return;

    const prizePool = t.prizepool || 0;

    const matchRows = (await client.query(
        `SELECT round, player1id, player2id, winnerid, stage FROM tournament_matches
         WHERE tournamentid = $1 AND stage IN ('playoff', 'third_place')`, [tournamentId]
    )).rows;
    const participantRows = (await client.query(
        'SELECT userid FROM tournament_participants WHERE tournamentid = $1', [tournamentId]
    )).rows;
    const rewards = calculateTournamentRewards({
        prizePool,
        participantIds: participantRows.map((row: any) => Number(row.userid)),
        matches: matchRows.map((row: any) => ({
            round: Number(row.round),
            player1Id: row.player1id == null ? null : Number(row.player1id),
            player2Id: row.player2id == null ? null : Number(row.player2id),
            winnerId: row.winnerid == null ? null : Number(row.winnerid),
            stage: row.stage || undefined,
        })),
    });
    if (rewards.length === 0) return;
    const winnerId = rewards[0]!.userId;
    const secondPlaceId = rewards.find(reward => reward.place === 2)?.userId || null;
    const thirdPlaceId = rewards.find(reward => reward.place === 3)?.userId || null;

    for (const reward of rewards) {
        if (reward.prize > 0) {
            await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [reward.prize, reward.userId]);
        }
        await saveTournamentResultTx(client, tournamentId, reward.userId, reward.place, reward.prize);
    }
    await client.query('UPDATE users SET tournamentwins = tournamentwins + 1 WHERE id = $1', [winnerId]);
    if (t.type === 'official') {
        const divisionProgressRow = (await client.query(
            `SELECT tournament_division, tournament_division_wins
             FROM users WHERE id = $1 FOR UPDATE`,
            [winnerId]
        )).rows[0];
        const currentDivision = assignTournamentDivision(
            divisionProgressRow?.tournament_division,
            parseTournamentSnapshot(
                (await client.query(
                    'SELECT snapshotstats FROM tournament_participants WHERE tournamentid = $1 AND userid = $2',
                    [tournamentId, winnerId]
                )).rows[0]?.snapshotstats
            )?.combatPower || 1,
        );
        const divisionProgress = applyDivisionChampionship({
            division: currentDivision,
            championships: Number(divisionProgressRow?.tournament_division_wins || 0),
        });
        await client.query(
            `UPDATE users
             SET tournament_division = $1, tournament_division_wins = $2
             WHERE id = $3`,
            [divisionProgress.division, divisionProgress.championships, winnerId]
        );
    }
    checkAchievement(winnerId, 'tournament').catch(() => {});

    await client.query('UPDATE tournaments SET status = $1, completedat = $2 WHERE id = $3',
        ['completed', new Date().toISOString(), tournamentId]);

    const allParts = await client.query(
        'SELECT userid FROM tournament_participants WHERE tournamentid = $1', [tournamentId]
    );

    for (const p of allParts.rows) {
        let delta = 0;
        if (p.userid === winnerId) delta = 25;
        else if (p.userid === secondPlaceId) delta = 15;
        else if (p.userid === thirdPlaceId) delta = 10;
        else {
            const wonInR1 = await client.query(
                `SELECT id FROM tournament_matches
                 WHERE tournamentid = $1 AND stage = 'playoff' AND round = 1 AND winnerid = $2`,
                [tournamentId, p.userid]
            );
            if (wonInR1.rows.length > 0) delta = 3;
            else delta = -3;
        }
        await client.query('UPDATE users SET tournamentelo = GREATEST(100, tournamentelo + $1) WHERE id = $2',
            [delta, p.userid]);
    }
}

// ---------------------------------------------------------------------------
// Автопродвижение (вызывается при каждом GET /tournament)
// ---------------------------------------------------------------------------

export async function mergeExpiredOfficialQueues(): Promise<number[]> {
    const createdIds = await db.tx(mergeExpiredOfficialQueuesTx);
    broadcast('tournamentUpdated', {
        reason: createdIds.length > 0 ? 'brackets_created' : 'registration_closed',
        tournamentIds: createdIds,
    });
    return createdIds;
}

/** Резервирует общий фонд official-регистраций и делит его между открытыми группами. */
export async function rebalanceOfficialQueuePools(): Promise<void> {
    await db.tx(rebalanceOfficialQueuePoolsTx);
}

/** Проверяет целостность единой official-очереди перед перераспределением фонда. */
export async function reconcileOfficialQueueParticipants(): Promise<void> {
    await db.tx(reconcileOfficialQueueParticipantsTx);
}

export async function reconcileOfficialQueueParticipantsTx(client: any): Promise<void> {
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1) as locked', [987654323]);
    if (!lock.rows[0]?.locked) return;
    const rows = (await client.query(
        `SELECT t.id tournamentid, t.division, tp.userid, tp.snapshotstats
         FROM tournaments t JOIN tournament_participants tp ON tp.tournamentid = t.id
         WHERE t.type = 'official' AND t.status = 'registration'
         ORDER BY t.id, tp.id FOR UPDATE OF t, tp`
    )).rows;
    const seenUsers = new Set<number>();
    for (const row of rows) {
        if (row.division !== 'official-cycle') {
            throw new Error(`Legacy official queue ${row.tournamentid} must be migrated before scheduler start`);
        }
        const userId = Number(row.userid);
        if (seenUsers.has(userId)) throw new Error(`User ${userId} registered in multiple official queues`);
        seenUsers.add(userId);
        const snapshot = parseTournamentSnapshot(row.snapshotstats);
        if (!snapshot || snapshot.divisionIndex == null) {
            throw new Error(`Invalid tournament snapshot for user ${userId}`);
        }
    }
}

export async function rebalanceOfficialQueuePoolsTx(client: any): Promise<void> {
        const lock = await client.query('SELECT pg_try_advisory_xact_lock($1) as locked', [987654322]);
        if (!lock.rows[0]?.locked) return;
        const now = Math.floor(Date.now() / 1000);
        const queues = (await client.query(
            `SELECT t.id, t.division, COALESCE(t.basepool, 0) basepool,
                    (SELECT AVG((tp.snapshotstats::jsonb->>'combatPower')::numeric)
                     FROM tournament_participants tp
                     WHERE tp.tournamentid = t.id AND tp.snapshotstats LIKE '%"combatPower"%') avgpower
             FROM tournaments t
             WHERE t.type = 'official' AND t.status = 'registration'
               AND t.registrationstart <= $1 AND t.registrationend > $1
             ORDER BY t.id FOR UPDATE OF t`,
            [now]
        )).rows;
        if (queues.length === 0) return;

        const treasuryResult = await client.query('SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE');
        const treasury = Number(treasuryResult.rows[0]?.amount) || 0;
        const reserved = queues.reduce((sum: number, queue: any) => sum + Number(queue.basepool || 0), 0);
        const target = Math.floor((treasury + reserved) * 0.10);
        const additionalReserve = Math.max(0, target - reserved);
        const totalReserve = reserved + additionalReserve;

        if (additionalReserve > 0) {
            await client.query('UPDATE castle_treasury SET amount = amount - $1, updated_at = NOW() WHERE id = 1', [additionalReserve]);
            await client.query('INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())', [-additionalReserve, 'tournament_reserve']);
        }

        const weights = queues.map((queue: any) => {
            const technicalNumber = Number(String(queue.division || '').match(/-(\d+)$/)?.[1]) || 1;
            const fallback = getPowerDivisionByNumber(technicalNumber);
            return getPowerPrizeWeight(Number(queue.avgpower) || Math.round((fallback.minPower + fallback.maxPower) / 2));
        });
        const totalWeight = weights.reduce((sum: number, weight: number) => sum + weight, 0) || 1;
        let allocated = 0;
        for (let index = 0; index < queues.length; index++) {
            const share = index === queues.length - 1
                ? totalReserve - allocated
                : Math.floor(totalReserve * weights[index] / totalWeight);
            allocated += share;
            await client.query('UPDATE tournaments SET prizepool = $1, basepool = $1 WHERE id = $2', [share, queues[index].id]);
        }
}

export async function mergeExpiredOfficialQueuesTx(client: any): Promise<number[]> {
    const createdIds: number[] = [];
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1) as locked', [987654321]);
        if (!lock.rows[0]?.locked) return createdIds;

        const now = Math.floor(Date.now() / 1000);
        const allRegistrationRows = (await client.query(
            `SELECT id, registrationend FROM tournaments
             WHERE type = 'official' AND status = 'registration' ORDER BY registrationend, id`
        )).rows;
        const readyIds = selectReadyQueueWindow(
            allRegistrationRows.map((row: any) => ({ id: Number(row.id), registrationEnd: Number(row.registrationend) })),
            now,
            OFFICIAL_MERGE_WAIT,
        );
        if (readyIds.length === 0) return createdIds;
        const queueRows = (await client.query(
            `SELECT id, division, name, COALESCE(basepool, 0) basepool FROM tournaments
             WHERE id = ANY($1::int[]) AND type = 'official' AND status = 'registration'
             ORDER BY id FOR UPDATE`, [readyIds]
        )).rows;
        if (queueRows.length === 0) return createdIds;

        const queueIds = queueRows.map((row: any) => Number(row.id));
        const participantRows = (await client.query(
            `SELECT tournamentid, userid, snapshotstats
             FROM tournament_participants WHERE tournamentid = ANY($1::int[])`, [queueIds]
        )).rows;
        const byQueue = new Map<number, Array<{ userId: number; combatPower: number; snapshotStats: any }>>();
        const snapshotByQueueAndUser = new Map<string, any>();
        const sourceQueueByUser = new Map<number, number>();
        for (const row of participantRows) {
            const snapshot = parseTournamentSnapshot(row.snapshotstats);
            if (!snapshot) continue;
            const queueId = Number(row.tournamentid);
            const participants = byQueue.get(queueId) || [];
            participants.push({ userId: Number(row.userid), combatPower: snapshot.combatPower, snapshotStats: row.snapshotstats });
            byQueue.set(queueId, participants);
            const snapshotKey = `${queueId}:${Number(row.userid)}`;
            if (snapshotByQueueAndUser.has(snapshotKey)) throw new Error(`Duplicate tournament participant ${snapshotKey}`);
            snapshotByQueueAndUser.set(snapshotKey, row.snapshotstats);
            const userId = Number(row.userid);
            const previousQueue = sourceQueueByUser.get(userId);
            if (previousQueue !== undefined && previousQueue !== queueId) {
                throw new Error(`User ${userId} exists in multiple official queues`);
            }
            sourceQueueByUser.set(userId, queueId);
        }

        const allParticipants = queueRows.flatMap((row: any) =>
            (byQueue.get(Number(row.id)) || []).map(participant => ({
                userId: participant.userId,
                combatPower: participant.combatPower,
                division: parseTournamentSnapshot(participant.snapshotStats)?.divisionIndex
                    ?? getTournamentDivision(participant.combatPower).index,
            }))
        );
        const split = splitParticipantsByDivision(allParticipants);
        const totalReserve = queueRows.reduce((sum: number, row: any) => sum + Number(row.basepool || 0), 0);
        const allocation = allocateDivisionPrizePools(
            totalReserve,
            split,
            participant => getPowerPrizeWeight(participant.combatPower),
        );
        for (const group of split.divisions) {
            const powers = group.participants.map(p => p.combatPower);
            const division = getTournamentDivisionByIndex(group.division);
            const prizePool = allocation.divisionPools.find(pool => pool.division === group.division)?.prizePool || 0;
            const created = await client.query(
                `INSERT INTO tournaments
                 (division, status, registrationstart, registrationend, prizepool, basepool, createdat, type, maxplayers, name)
                 VALUES ($1, 'in_progress', $2, $2, $3, $3, $4, 'official', $5, $6) RETURNING id`,
                [division.key, now, prizePool, new Date().toISOString(), group.participants.length, division.label]
            );
            const tournamentId = Number(created.rows[0].id);
            createdIds.push(tournamentId);
            const groupSources = group.participants.map(participant => {
                const sourceQueueId = sourceQueueByUser.get(participant.userId);
                if (sourceQueueId === undefined) throw new Error(`Source queue not found for user ${participant.userId}`);
                const snapshot = parseTournamentSnapshot(
                    snapshotByQueueAndUser.get(`${sourceQueueId}:${participant.userId}`)
                );
                if (!snapshot) throw new Error(`Snapshot not found for user ${participant.userId}`);
                return { participant, snapshot };
            });
            const needsNormalization = Math.max(...powers) > 0 && (Math.max(...powers) - Math.min(...powers)) / Math.max(...powers) > 0.10;
            const validSnapshots = groupSources.map(source => source.snapshot).filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));
            const normalizedSnapshots = needsNormalization ? normalizeTournamentGroup(validSnapshots) : validSnapshots;
            const snapshotByUser = new Map(normalizedSnapshots.map(snapshot => [snapshot.player.id, snapshot]));
            for (const { participant, snapshot } of groupSources) {
                await client.query(
                    'INSERT INTO tournament_participants (tournamentid, userid, snapshotstats) VALUES ($1, $2, $3)',
                    [tournamentId, participant.userId, JSON.stringify(snapshotByUser.get(participant.userId) || snapshot)]
                );
            }
        }

        const waitingUserIds = split.singletons.map(participant => participant.userId);
        let carriedReserve = 0;
        if (waitingUserIds.length > 0) {
            carriedReserve = allocation.refund;
            const registrationStart = now + OFFICIAL_INTERVAL;
            const registrationEnd = registrationStart + REGISTRATION_WINDOW;
            const waitingQueue = await client.query(
                `INSERT INTO tournaments
                 (division, status, registrationstart, registrationend, prizepool, basepool, createdat, type, maxplayers, name)
                 VALUES ('official-cycle', 'registration', $1, $2, $3, $3, $4, 'official', 1000000, 'Общий набор')
                 RETURNING id`,
                [registrationStart, registrationEnd, carriedReserve, new Date().toISOString()]
            );
            const waitingTournamentId = Number(waitingQueue.rows[0].id);
            for (const participant of split.singletons) {
                const sourceQueueId = sourceQueueByUser.get(participant.userId);
                if (sourceQueueId === undefined) throw new Error(`Source queue not found for waiting user ${participant.userId}`);
                const snapshotStats = snapshotByQueueAndUser.get(`${sourceQueueId}:${participant.userId}`);
                if (!snapshotStats) throw new Error(`Snapshot not found for waiting user ${participant.userId}`);
                await client.query(
                    'INSERT INTO tournament_participants (tournamentid, userid, snapshotstats) VALUES ($1, $2, $3)',
                    [waitingTournamentId, participant.userId, snapshotStats]
                );
            }
        }

        const treasuryRefund = allocation.refund - carriedReserve;
        if (treasuryRefund > 0) {
            await client.query('UPDATE castle_treasury SET amount = amount + $1, updated_at = NOW() WHERE id = 1', [treasuryRefund]);
            await client.query('INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())', [treasuryRefund, 'tournament_reserve_return']);
        }
        const movedUserIds = [
            ...split.divisions.flatMap(group => group.participants.map(participant => participant.userId)),
            ...waitingUserIds,
        ];
        if (movedUserIds.length > 0) {
            await client.query(
                'DELETE FROM tournament_participants WHERE tournamentid = ANY($1::int[]) AND userid = ANY($2::int[])',
                [queueIds, movedUserIds]
            );
        }
        await client.query(
            `UPDATE tournaments SET status = 'cancelled', completedat = $1 WHERE id = ANY($2::int[])`,
            [new Date().toISOString(), queueIds]
        );
        for (const tournamentId of createdIds) await generateBracketTx(client, tournamentId);
    return createdIds;
}

export async function autoAdvance(tournamentId: number) {
    // Защита от параллельных вызовов через транзакционный advisory lock
    try {
        await db.tx(async (client) => {
            const lockResult = await client.query('SELECT pg_try_advisory_xact_lock($1) as locked', [tournamentId]);
            if (!lockResult.rows[0]?.locked) {
                // Другой вызов уже обрабатывает этот турнир — выходим
                return;
            }

            const tResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
            const t = tResult.rows[0];
            if (!t) return;

            const now = Math.floor(Date.now() / 1000);

            if (t.status === 'registration' && t.type === 'official') {
                // Official queues are merged in one batch by the scheduler.
                return;
            }
            if (t.status === 'registration' && now >= t.registrationend) {
                console.log(`[autoAdv] tid=${tournamentId} registration→in_progress`);
                await client.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['in_progress', tournamentId]);
                // Генерируем скобку внутри той же транзакции — защита от дубликатов
                await generateBracketTx(client, tournamentId);
                // После генерации скобки — разрешаем все раунды в цикле
                await advanceAllRoundsTx(client, tournamentId);
                return;
            }

            if (t.status === 'in_progress') {
                const matchCountResult = await client.query(
                    'SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournamentid = $1', [tournamentId]
                );
                const matchCount = parseInt(matchCountResult.rows[0]?.cnt, 10) || 0;
                if (matchCount === 0) {
                    console.log('[autoAdv] tid=' + tournamentId + ' in_progress but 0 matches - regenerating bracket');
                    await generateBracketTx(client, tournamentId);
                    await advanceAllRoundsTx(client, tournamentId);
                    return;
                }
                await advanceAllRoundsTx(client, tournamentId);
                return;
            }

            // Турнир завершён или отменён — новый создаст getOrCreateTournament в следующем тике
            if ((t.status === 'completed' || t.status === 'cancelled') && t.type === 'official') {
                return;
            }
        });
        broadcast('tournamentUpdated', { reason: 'tournament_advanced', tournamentId });
    } catch (err) {
        console.error('[autoAdv] tid=' + tournamentId + ' error:', err);
    }
}

/**
 * Генерация скобки внутри транзакции (client вместо db).
 */
async function runGroupFightTx(
    client: any,
    tournamentId: number,
    player1Id: number,
    player2Id: number,
    metadata: GroupFightMetadata,
): Promise<number> {
    const player1 = await loadTournamentPlayerTx(client, tournamentId, player1Id);
    const player2 = await loadTournamentPlayerTx(client, tournamentId, player2Id);
    if (!player1 || !player2) throw new Error(`Не удалось загрузить бойцов ${player1Id}/${player2Id}`);
    const result = runBattle(player1, player2);
    const steps = result.steps.filter((step: any) => step.type !== 'money');
    const normalizationStep = tournamentNormalizationStep(player1, player2);
    if (normalizationStep) steps.unshift(normalizationStep as any);
    await client.query(
        `INSERT INTO tournament_matches
         (tournamentid, round, player1id, player2id, winnerid, log, stage, group_name, series_index)
         VALUES ($1, 0, $2, $3, $4, $5, $6, $7, $8)`,
        [tournamentId, player1Id, player2Id, result.winnerId, JSON.stringify(steps), metadata.stage, metadata.groupName, metadata.seriesIndex]
    );
    return Number(result.winnerId);
}

async function generateBracketTx(client: any, tournamentId: number) {
    const existing = await client.query(
        'SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournamentid = $1', [tournamentId]
    );
    if (parseInt(existing.rows[0]?.cnt, 10) > 0) {
        console.log(`[bracket] tid=${tournamentId} already has matches, skip`);
        return;
    }

    const partRows = await client.query(
        `SELECT tp.userid, tp.snapshotstats FROM tournament_participants tp
         WHERE tp.tournamentid = $1 ORDER BY tp.userid`,
        [tournamentId]
    );
    const participants = partRows.rows;
    for (let index = participants.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [participants[index], participants[swapIndex]] = [participants[swapIndex], participants[index]];
    }

    console.log(`[bracket] tid=${tournamentId} participants=${participants.length}`);
    if (participants.length < 2) {
        console.log(`[bracket] tid=${tournamentId} SKIP < 2`);
        const tResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        const t = tResult.rows[0];
        if (t && t.type === 'custom') {
            if ((t.basepool || 0) > 0) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [t.basepool, t.creatorid]);
            }
            if ((t.entryfee || 0) > 0) {
                const parts = await client.query(
                    'SELECT userid FROM tournament_participants WHERE tournamentid = $1', [tournamentId]
                );
                for (const p of parts.rows) {
                    await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [t.entryfee, p.userid]);
                }
            }
        } else if (t) {
            // official: возврат basePool в казну, взносы — игрокам
            if ((t.basepool || 0) > 0) {
                await client.query('UPDATE castle_treasury SET amount = amount + $1, updated_at = NOW() WHERE id = 1', [t.basepool]);
                await client.query('INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())', [t.basepool, 'tournament_cancel_official']);
            }
            if ((t.entryfee || 0) > 0) {
                const parts = await client.query(
                    'SELECT userid FROM tournament_participants WHERE tournamentid = $1', [tournamentId]
                );
                for (const p of parts.rows) {
                    await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [t.entryfee, p.userid]);
                }
            }
        }
        await client.query('UPDATE tournaments SET status = $1, completedat = $2 WHERE id = $3',
            ['cancelled', new Date().toISOString(), tournamentId]);
        return;
    }

    const tournamentType = (await client.query('SELECT type FROM tournaments WHERE id = $1', [tournamentId])).rows[0]?.type;
    if (tournamentType === 'official' && participants.length > 8) {
        const groupResult = await runTournamentGroupStage({
            userIds: participants.map((participant: any) => Number(participant.userid)),
            fight: (player1Id, player2Id, metadata) =>
                runGroupFightTx(client, tournamentId, player1Id, player2Id, metadata),
        });
        for (const [player1Id, player2Id] of groupResult.playoffPairs) {
            await client.query(
                `INSERT INTO tournament_matches
                 (tournamentid, round, player1id, player2id, stage)
                 VALUES ($1, 1, $2, $3, 'playoff')`,
                [tournamentId, player1Id, player2Id]
            );
        }
        return;
    }

    const n = participants.length;
    const slots = nextPowerOfTwo(n);
    const byes = slots - n;
    const playInRound1 = n - byes;

    console.log('[bracket] n=' + n + ' slots=' + slots + ' byes=' + byes + ' playR1=' + playInRound1);

    for (let i = 0; i < byes; i++) {
        const p = participants[i];
        await client.query(
            `INSERT INTO tournament_matches
             (tournamentid, round, player1id, player2id, winnerid, stage)
             VALUES ($1, 1, $2, NULL, $2, 'playoff')`,
            [tournamentId, p.userid]
        );
        console.log('[bracket] bye: userid=' + p.userid + ' -> round 2');
    }

    for (let i = 0; i < playInRound1 / 2; i++) {
        const p1 = participants[byes + i * 2];
        const p2 = participants[byes + i * 2 + 1];
        await client.query(
            `INSERT INTO tournament_matches
             (tournamentid, round, player1id, player2id, stage)
             VALUES ($1, 1, $2, $3, 'playoff')`,
            [tournamentId, p1.userid, p2.userid]
        );
        console.log('[bracket] R1: ' + p1.userid + ' vs ' + p2.userid);
    }
}

/**
 * Разрешить все раунды турнира последовательно внутри одной транзакции.
 */
export async function advanceAllRoundsTx(client: any, tournamentId: number) {
    let safety = 0;
    const MAX_ROUNDS = 32;
    while (safety < MAX_ROUNDS) {
        safety++;
        // Находим минимальный раунд с незавершёнными матчами
        const pendingResult = await client.query(
            `SELECT round FROM tournament_matches
             WHERE tournamentid = $1 AND stage IN ('playoff', 'third_place') AND winnerid IS NULL
             ORDER BY round LIMIT 1`,
            [tournamentId]
        );
        if (pendingResult.rows.length === 0) {
            // Все раунды завершены
            const tCheck = await client.query('SELECT status FROM tournaments WHERE id = $1', [tournamentId]);
            if (tCheck.rows[0]?.status === 'in_progress') {
                await finishTournamentTx(client, tournamentId);
            }
            return;
        }

        const round = pendingResult.rows[0].round;
        const matches = await client.query(
            `SELECT * FROM tournament_matches
             WHERE tournamentid = $1 AND stage IN ('playoff', 'third_place') AND round = $2 AND winnerid IS NULL`,
            [tournamentId, round]
        );

        for (const match of matches.rows) {
            if (!match.player1id || !match.player2id) continue;

            const p1 = await loadTournamentPlayerTx(client, tournamentId, match.player1id);
            const p2 = await loadTournamentPlayerTx(client, tournamentId, match.player2id);
            if (!p1 || !p2) continue;

            const result = runBattle(p1, p2);
            const tourSteps = result.steps.filter((s: any) => s.type !== 'money');
            const normalizationStep = tournamentNormalizationStep(p1, p2);
            if (normalizationStep) tourSteps.unshift(normalizationStep as any);
            await client.query(
                'UPDATE tournament_matches SET winnerid = $1, log = $2 WHERE id = $3',
                [result.winnerId, JSON.stringify(tourSteps), match.id]
            );
        }

        // Создаём матчи следующего раунда
        const nextRound = round + 1;
        if (nextRound > 32) {
            console.error(`[advanceAllRounds] tid=${tournamentId} nextRound=${nextRound} exceeds limit — forcing finish`);
            await finishTournamentTx(client, tournamentId);
            return;
        }

        // Идемпотентность: если матчи этого раунда уже созданы — пропускаем
        const existingCnt = await client.query(
            `SELECT COUNT(*) as cnt FROM tournament_matches
             WHERE tournamentid = $1 AND stage = 'playoff' AND round = $2`,
            [tournamentId, nextRound]
        );
        if (parseInt(existingCnt.rows[0]?.cnt, 10) > 0) {
            console.log(`[advanceAllRounds] tid=${tournamentId} round=${nextRound} already has matches — skipping`);
            continue;
        }

        const winners = await client.query(
            `SELECT winnerid FROM tournament_matches
             WHERE tournamentid = $1 AND stage = 'playoff' AND round = $2 AND winnerid IS NOT NULL
             ORDER BY id`,
            [tournamentId, round]
        );

        if (winners.rows.length < 2) {
            // Legacy-safe path: если финал уже существовал до новой логики,
            // создаём бронзовый матч из проигравших полуфиналов до завершения.
            if (round >= 2) {
                const thirdExists = await client.query(
                    `SELECT 1 FROM tournament_matches
                     WHERE tournamentid = $1 AND stage = 'third_place'`,
                    [tournamentId]
                );
                if (thirdExists.rows.length === 0) {
                    const previousRound = (await client.query(
                        `SELECT round, player1id, player2id, winnerid
                         FROM tournament_matches
                         WHERE tournamentid = $1 AND stage = 'playoff'
                           AND round = $2 AND winnerid IS NOT NULL
                           AND player1id IS NOT NULL AND player2id IS NOT NULL
                         ORDER BY id`,
                        [tournamentId, round - 1]
                    )).rows;
                    const thirdPlacePair = getThirdPlacePair(previousRound.map((match: any) => ({
                        round: Number(match.round),
                        stage: 'playoff',
                        player1Id: Number(match.player1id),
                        player2Id: Number(match.player2id),
                        winnerId: Number(match.winnerid),
                    })));
                    if (thirdPlacePair) {
                        await client.query(
                            `INSERT INTO tournament_matches
                             (tournamentid, round, player1id, player2id, stage)
                             VALUES ($1, $2, $3, $4, 'third_place')`,
                            [tournamentId, round + 1, thirdPlacePair[0], thirdPlacePair[1]]
                        );
                        continue;
                    }
                }
            }
            await finishTournamentTx(client, tournamentId);
            return;
        }

        const w = winners.rows;
        const n = w.length;
        const half = Math.floor(n / 2);
        for (let i = 0; i < half; i++) {
            await client.query(
                `INSERT INTO tournament_matches
                 (tournamentid, round, player1id, player2id, stage)
                 VALUES ($1, $2, $3, $4, 'playoff')`,
                [tournamentId, nextRound, w[i * 2].winnerid, w[i * 2 + 1].winnerid]
            );
        }
        if (n === 2) {
            const semifinalRows = (await client.query(
                `SELECT round, stage, player1id, player2id, winnerid
                 FROM tournament_matches
                 WHERE tournamentid = $1 AND stage = 'playoff' AND round = $2`,
                [tournamentId, round]
            )).rows;
            const thirdPlacePair = getThirdPlacePair(semifinalRows.map((match: any) => ({
                round: Number(match.round),
                stage: match.stage,
                player1Id: match.player1id == null ? null : Number(match.player1id),
                player2Id: match.player2id == null ? null : Number(match.player2id),
                winnerId: match.winnerid == null ? null : Number(match.winnerid),
            })));
            if (thirdPlacePair) {
                await client.query(
                    `INSERT INTO tournament_matches
                     (tournamentid, round, player1id, player2id, stage)
                     VALUES ($1, $2, $3, $4, 'third_place')`,
                    [tournamentId, nextRound, thirdPlacePair[0], thirdPlacePair[1]]
                );
            }
        }
        if (n % 2 === 1) {
            await client.query(
                `INSERT INTO tournament_matches
                 (tournamentid, round, player1id, player2id, winnerid, stage)
                 VALUES ($1, $2, $3, NULL, $3, 'playoff')`,
                [tournamentId, nextRound, w[n - 1].winnerid]
            );
        }
    }
    // Если вышли по safety — финишируем
    console.error(`[advanceAllRounds] tid=${tournamentId} safety limit reached — forcing finish`);
    await finishTournamentTx(client, tournamentId);
}

// ---------------------------------------------------------------------------
// Создание турнира (если нет активного)
// ---------------------------------------------------------------------------

export async function getOrCreateTournament(type?: string) {
    const now = Math.floor(Date.now() / 1000);

    const activeTournaments = await db.query(
        `SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') AND type = 'official' ORDER BY id DESC`,
        []
    ) as any[];

    // Пока жив хотя бы один турнир текущего общего набора, новый набор не открываем.
    if (activeTournaments.length > 0) return activeTournaments;

    // Технические очереди открываются одним общим набором, а не вслед за каждой завершённой.
    const lastOfficial = await db.one(
        `SELECT completedAt FROM tournaments
         WHERE type = 'official' AND status IN ('completed', 'cancelled') AND completedAt IS NOT NULL
         ORDER BY completedAt DESC LIMIT 1`, []
    ) as any;
    if (lastOfficial?.completedAt) {
        const completedMs = typeof lastOfficial.completedAt === 'number'
            ? lastOfficial.completedAt * 1000
            : Number(lastOfficial.completedAt) || new Date(lastOfficial.completedAt).getTime();
        if (Date.now() < completedMs + OFFICIAL_INTERVAL * 1000) return [];
    }

    await db.tx(async (client) => {
        const lock = await client.query('SELECT pg_advisory_xact_lock($1)', [987654320]);
        void lock;
        const recheck = (await client.query(
            `SELECT id FROM tournaments
             WHERE type = 'official' AND status IN ('registration', 'in_progress') LIMIT 1`
        )).rows[0];
        if (recheck) return;
        const treasuryRow = (await client.query(
            'SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE'
        )).rows[0];
        const reserve = Math.max(0, Math.floor(Number(treasuryRow?.amount || 0) * 0.1));
        if (reserve > 0) {
            await client.query(
                'UPDATE castle_treasury SET amount = amount - $1, updated_at = NOW() WHERE id = 1',
                [reserve]
            );
            await client.query(
                'INSERT INTO treasury_log (amount, source, created_at) VALUES ($1, $2, NOW())',
                [-reserve, 'tournament_cycle_reserve']
            );
        }
        await client.query(
            `INSERT INTO tournaments
             (division, status, registrationstart, registrationend, prizepool, basepool, createdat, type, maxplayers, name)
             VALUES ('official-cycle', 'registration', $1, $2, $3, $3, $4, 'official', 1000000, 'Общий набор')`,
            [now, now + REGISTRATION_WINDOW, reserve, new Date().toISOString()]
        );
    });

    const query = "SELECT * FROM tournaments WHERE status IN ('registration', 'in_progress') ORDER BY id DESC";
    return await db.query(query, []) as any[];
}

// ---------------------------------------------------------------------------
// Роуты
// ---------------------------------------------------------------------------

// Статус турнира
router.get('/tournament', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    let userCombatPower: number | undefined;
    if (req.query.includePower === '1') {
        userCombatPower = calculateCombatPower(await buildCombatPowerStats(user), undefined, user.level);
    }
    const divisionPower = userCombatPower
        ?? calculateCombatPower(await buildCombatPowerStats(user), undefined, user.level);
    const userDivisionIndex = assignTournamentDivision(
        user.tournamentDivision ?? user.tournament_division,
        divisionPower,
    );
    const userDivisionDefinition = getTournamentDivisionByIndex(userDivisionIndex);
    const userDivision = {
        index: userDivisionIndex,
        key: userDivisionDefinition.key,
        label: userDivisionDefinition.label,
        championships: Number(user.tournamentDivisionWins ?? user.tournament_division_wins ?? 0),
        championshipsRequired: 3,
    };

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
                    id: p.userId, username: p.username,
                    guildName: p.guildName, guildId: p.guildId,
                    snapshotStats: parseJsonValue(p.snapshotStats),
                })),
                top3: presentCompletedTournamentTop3(participants),
            };
        }));

        return res.json({ tournaments: result, total, page, totalPages: Math.ceil(total / limit), userLevel: user.level, userDivision, tab: 'completed' });
    }

    // Создание и продвижение выполняет scheduler, а GET только читает данные.
    const typeFilter = (req.query.type as string) || 'all';
    let typeCondition = '';
    const typeParams: any[] = [];
    if (typeFilter === 'official') { typeCondition = "AND type = 'official'"; }
    else if (typeFilter === 'custom') { typeCondition = "AND type = 'custom'"; }

    const updated = await db.query(
        `SELECT * FROM tournaments
         WHERE status IN ('registration', 'in_progress') ${typeCondition}
           AND (status = 'in_progress' OR registrationStart <= ?)
         ORDER BY id DESC`,
        [...typeParams, Math.floor(Date.now() / 1000)]
    ) as any[];

    const allTournaments = [...updated];
    const tournamentIds = allTournaments.map(t => Number(t.id));
    const placeholders = tournamentIds.map(() => '?').join(',');
    const allParticipants = tournamentIds.length > 0 ? await db.query(
        `SELECT u.username, g.name as guildName, u.guildId, tp.*
         FROM tournament_participants tp
         JOIN users u ON tp.userId = u.id
         LEFT JOIN guilds g ON u.guildId = g.id
         WHERE tp.tournamentId IN (${placeholders})`,
        tournamentIds
    ) as any[] : [];
    const allMatches = tournamentIds.length > 0 ? await db.query(
        `SELECT tm.*, p1.username as player1Name, p2.username as player2Name,
                w.username as winnerName
         FROM tournament_matches tm
         LEFT JOIN users p1 ON tm.player1Id = p1.id
         LEFT JOIN users p2 ON tm.player2Id = p2.id
         LEFT JOIN users w ON tm.winnerId = w.id
         WHERE tm.tournamentId IN (${placeholders})
         ORDER BY tm.tournamentId, tm.round, tm.id`,
        tournamentIds
    ) as any[] : [];
    const participantsByTournament = new Map<number, any[]>();
    const matchesByTournament = new Map<number, any[]>();
    for (const participant of allParticipants) {
        const id = Number(participant.tournamentId);
        const rows = participantsByTournament.get(id) || [];
        rows.push(participant);
        participantsByTournament.set(id, rows);
    }
    for (const match of allMatches) {
        const id = Number(match.tournamentId);
        const rows = matchesByTournament.get(id) || [];
        rows.push(match);
        matchesByTournament.set(id, rows);
    }

    const result = allTournaments.map((t) => {
        const participants = participantsByTournament.get(Number(t.id)) || [];
        const myReg = participants.find((p: any) => p.userId === userId);
        const matches = matchesByTournament.get(Number(t.id)) || [];

        const officialPowers = participants
            .map((participant: any) => parseTournamentSnapshot(participant.snapshotStats)?.combatPower)
            .filter((power: any): power is number => Number.isFinite(Number(power)))
            .map(Number);
        const normalized = participants.some((participant: any) => Boolean(parseTournamentSnapshot(participant.snapshotStats)?.normalization));
        const technicalDivisionNumber = Number(String(t.division || '').match(/-(\d+)$/)?.[1])
            || Number(t.name?.match(/\d+$/)?.[0]) || 1;
        const powerDivision = officialPowers.length > 0
            ? getPowerDivision(Math.round(officialPowers.reduce((sum, power) => sum + power, 0) / officialPowers.length))
            : getPowerDivisionByNumber(technicalDivisionNumber);
        const dynamicDivision = t.type === 'official' && t.division !== 'official-cycle'
            ? TOURNAMENT_DIVISIONS.find(division => division.key === t.division)
            : null;
        const visibleMinPower = officialPowers.length > 0 ? Math.min(...officialPowers) : powerDivision.minPower;
        const visibleMaxPower = officialPowers.length > 0 ? Math.max(...officialPowers) : powerDivision.maxPower;
        return {
            ...t,
            name: t.type === 'official' ? (dynamicDivision?.label || 'Общий набор') : t.name,
            divisionLabel: t.type === 'official' ? (dynamicDivision?.label || 'Общий набор') : t.division,
            minPower: t.type === 'official' ? visibleMinPower : undefined,
            maxPower: t.type === 'official' ? visibleMaxPower : undefined,
            normalized,
            minLevel: t.type === 'official' ? undefined : t.minLevel,
            maxLevel: t.type === 'official' ? undefined : t.maxLevel,
            participantCount: participants.length,
            maxPlayers: t.maxPlayers || MAX_PLAYERS,
            participants: participants.map((p) => ({
                id: p.userId,
                username: p.username,

                guildName: p.guildName, guildId: p.guildId,
                snapshotStats: parseJsonValue(p.snapshotStats),
            })),
            myRegistration: myReg ? { ...myReg, snapshotStats: parseJsonValue(myReg.snapshotStats) } : null,
            matches: matches.map((m) => ({
                ...m,
                log: m.log ? JSON.parse(m.log) : null,
            })),
        };
    });

    // Сортировка: своя запись, свой диапазон БМ, затем official по возрастанию БМ.
    const userDynamicDivision = userDivision.key;
    result.sort((a: any, b: any) => {
        if (Boolean(a.myRegistration) !== Boolean(b.myRegistration)) return a.myRegistration ? -1 : 1;
        if (a.type === 'official' && b.type !== 'official') return -1;
        if (a.type !== 'official' && b.type === 'official') return 1;
        if (a.type === 'official' && b.type === 'official') {
            const aOwnRange = a.division === userDynamicDivision || (a.division === 'official-cycle' && Boolean(a.myRegistration));
            const bOwnRange = b.division === userDynamicDivision || (b.division === 'official-cycle' && Boolean(b.myRegistration));
            if (aOwnRange !== bOwnRange) return aOwnRange ? -1 : 1;
            return (a.minPower || 0) - (b.minPower || 0) || a.registrationEnd - b.registrationEnd;
        }
        const aCanJoin = user.level >= (a.minLevel || 1) && user.level <= (a.maxLevel || 999);
        const bCanJoin = user.level >= (b.minLevel || 1) && user.level <= (b.maxLevel || 999);
        if (aCanJoin && !bCanJoin) return -1;
        if (!aCanJoin && bCanJoin) return 1;
        return a.registrationEnd - b.registrationEnd;
    });

    // Предстоящие официальные турниры открываются общим набором раз в 8 часов.
    const upcomingOfficial: any[] = [];
    const activeOfficialRows = typeFilter === 'custom' ? await db.query(
        "SELECT division FROM tournaments WHERE status IN ('registration', 'in_progress') AND type = 'official'",
        []
    ) as any[] : updated.filter(t => t.type === 'official');
    const activeOfficialDivisions = new Set(activeOfficialRows.map(t => t.division));
    const lastCompletedRow = await db.one(
        `SELECT completedAt FROM tournaments
         WHERE type = 'official' AND status IN ('completed', 'cancelled') AND completedAt IS NOT NULL
         ORDER BY completedAt DESC LIMIT 1`, []
    ) as any;
    for (const div of divisions) {
        if (activeOfficialDivisions.has(div.name)) continue;
        // При частично активном наборе отсутствующие технические очереди не
        // рекламируем как отдельный предстоящий турнир.
        if (activeOfficialDivisions.size > 0) continue;
        const lastCompleted = lastCompletedRow?.completedAt;
        if (lastCompleted) {
            const ts = typeof lastCompleted === 'number' ? lastCompleted * 1000
              : Number(lastCompleted) || new Date(lastCompleted).getTime();
            const registrationOpensAt = ts + OFFICIAL_INTERVAL * 1000;
            if (Date.now() < registrationOpensAt) {
                upcomingOfficial.push({
                    division: div.name,
                    label: div.label,
                    icon: div.icon,
                    minPower: div.minPower,
                    maxPower: div.maxPower,
                    registrationOpensAt: Math.floor(registrationOpensAt / 1000),
                });
            }
        }
    }

    const nextOfficialRegistrationAt = await getNextOfficialRegistrationAt();
    res.json({ tournaments: result, userLevel: user.level, userCombatPower, userDivision, tab: 'active', typeFilter,
        upcomingOfficial, nextOfficialRegistrationAt
    });
});

// Регистрация
router.post('/tournament/register', async (req, res) => {
    const userId = req.userId;
    const { division } = req.body;

    const user = await db.one('SELECT level, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const snapshot = await buildTournamentSnapshotForUser(userId);
    if (!snapshot) return res.status(404).json({ error: 'User not found' });

    let tournament: any;
    if (division) {
        const existingOfficial = await db.one(
            `SELECT tp.id FROM tournament_participants tp
             JOIN tournaments t ON t.id = tp.tournamentId
             WHERE tp.userId = ? AND t.type = 'official' AND t.status IN ('registration', 'in_progress') LIMIT 1`,
            [userId]
        ) as any;
        if (existingOfficial) return res.status(400).json({ error: 'Вы уже зарегистрированы в официальном турнире' });

        // Все игроки регистрируются в одну очередь общего цикла. Дивизионы
        // формируются после закрытия окна по индексу, сохранённому в snapshot.
        tournament = await db.one(
            `SELECT t.* FROM tournaments t
             WHERE t.division = ? AND t.status = 'registration' AND t.type = 'official'
               AND t.registrationStart <= ? AND t.registrationEnd > ?
             ORDER BY t.id DESC LIMIT 1`,
            ['official-cycle', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
        ) as any;
        if (!tournament) {
            const now = Math.floor(Date.now() / 1000);
            const activeQueues = await db.query(
                `SELECT registrationStart, registrationEnd FROM tournaments
                 WHERE type = 'official' AND status = 'registration'
                   AND registrationStart <= ? AND registrationEnd > ?
                 ORDER BY registrationEnd`,
                [now, now]
            ) as any[];
            const registrationWindow = getRegistrationWindowForNewQueue({
                now,
                activeQueues: activeQueues.map(queue => ({
                    registrationStart: Number(queue.registrationStart),
                    registrationEnd: Number(queue.registrationEnd),
                })),
            });
            const inProgress = await db.one(
                `SELECT id FROM tournaments
                 WHERE type = 'official' AND status = 'in_progress' LIMIT 1`, []
            ) as any;
            if (inProgress && activeQueues.length === 0) {
                return res.status(400).json({ error: 'Текущий турнир уже идёт. Следующая регистрация откроется после завершения цикла' });
            }
            if (activeQueues.length === 0) {
                const registrationOpensAt = await getNextOfficialRegistrationAt();
                if (registrationOpensAt) {
                    return res.status(400).json({
                        error: 'Регистрация в следующий официальный турнир ещё не открыта',
                        registrationOpensAt,
                    });
                }
            }
            if (!registrationWindow) {
                return res.status(400).json({ error: 'Регистрация текущего набора завершена' });
            }
            await getOrCreateTournament();
            tournament = await db.one(
                `SELECT * FROM tournaments
                 WHERE division = 'official-cycle' AND type = 'official' AND status = 'registration'
                   AND registrationStart <= ? AND registrationEnd > ?
                 ORDER BY id DESC LIMIT 1`,
                [now, now]
            ) as any;
            if (!tournament) return res.status(400).json({ error: 'Регистрация текущего набора завершена' });
        }
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

    }

    if (!tournament) return res.status(400).json({ error: 'Регистрация закрыта' });

    let registrationResult: { count: number; maxPlayers: number };
    try {
        registrationResult = await db.tx(async (client) => {
        const lockedTournament = (await client.query(
            `SELECT * FROM tournaments WHERE id = $1 FOR UPDATE`, [tournament.id]
        )).rows[0];
        if (!lockedTournament || lockedTournament.status !== 'registration') {
            throw new Error('Турнир не найден или регистрация закрыта');
        }
        const transactionNow = Math.floor(Date.now() / 1000);
        if (lockedTournament.type === 'official'
            && (Number(lockedTournament.registrationstart) > transactionNow
                || Number(lockedTournament.registrationend) <= transactionNow)) {
            throw new Error('Регистрация в официальный турнир ещё не открыта или уже завершена');
        }
        const lockedUser = (await client.query(
            'SELECT money FROM users WHERE id = $1 FOR UPDATE', [userId]
        )).rows[0];
        const existing = (await client.query(
            'SELECT id FROM tournament_participants WHERE tournamentid = $1 AND userid = $2',
            [tournament.id, userId]
        )).rows[0];
        if (existing) throw new Error('Вы уже зарегистрированы');
        const currentCount = Number((await client.query(
            'SELECT COUNT(*) AS cnt FROM tournament_participants WHERE tournamentid = $1',
            [tournament.id]
        )).rows[0]?.cnt || 0);
        const maxPlayers = lockedTournament.type === 'custom'
            ? Number(lockedTournament.maxplayers || 8)
            : Number.MAX_SAFE_INTEGER;
        if (currentCount >= maxPlayers) throw new Error('Турнир заполнен');
        const entryFee = lockedTournament.type === 'custom' ? Number(lockedTournament.entryfee || 0) : 0;
        if (entryFee > 0) {
            if (Number(lockedUser?.money || 0) < entryFee) {
                throw new Error(`Недостаточно серебра для взноса (${entryFee})`);
            }
            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [entryFee, userId]);
            await client.query('UPDATE tournaments SET prizepool = prizepool + $1 WHERE id = $2', [entryFee, tournament.id]);
        }
        await client.query(
            'INSERT INTO tournament_participants (tournamentid, userid, snapshotstats) VALUES ($1, $2, $3)',
            [tournament.id, userId, JSON.stringify(snapshot)]
        );
        if (lockedTournament.type === 'official') {
            await client.query(
                `UPDATE users
                 SET tournament_division = COALESCE(tournament_division, $1),
                     tournamentcount = tournamentcount + 1
                 WHERE id = $2`,
                [snapshot.divisionIndex, userId]
            );
        } else {
            await client.query(
                'UPDATE users SET tournamentcount = tournamentcount + 1 WHERE id = $1',
                [userId]
            );
        }
            return { count: currentCount + 1, maxPlayers };
        });
    } catch (error: any) {
        const message = error?.message || 'Ошибка регистрации';
        const expected = /уже зарегистрированы|заполнен|Недостаточно серебра|регистрация закрыта|не найден/i.test(message);
        return res.status(expected ? 400 : 500).json({ error: message });
    }
    broadcast('tournamentUpdated', { reason: 'participant_registered', tournamentId: tournament.id, userId });

    // Автостарт при заполнении
    if (tournament.type === 'custom' && registrationResult.count >= registrationResult.maxPlayers) {
        await db.tx(async (client) => {
            await client.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['in_progress', tournament.id]);
            await generateBracketTx(client, tournament.id);
            await advanceAllRoundsTx(client, tournament.id);
        });
        res.json({ success: true, started: true, tournamentId: tournament.id, division: tournament.division });
        return;
    }

    const assignedDivision = getTournamentDivisionByIndex(snapshot.divisionIndex || 0);
    res.json({
        success: true,
        tournamentId: tournament.id,
        division: assignedDivision.key,
        divisionLabel: assignedDivision.label,
        combatPower: snapshot.combatPower,
    });
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

    const totalCost = prizePool + entryFee;
    if (Number(user.money || 0) < totalCost) {
        return res.status(400).json({ error: 'Недостаточно серебра для призового фонда и входного взноса' });
    }
    const snapshot = await buildTournamentSnapshotForUser(userId);
    if (!snapshot) return res.status(404).json({ error: 'User not found' });

    let tournamentId: number;
    try {
        tournamentId = await db.tx(async (client) => {
        const lockedUser = (await client.query('SELECT money FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
        if (Number(lockedUser?.money || 0) < totalCost) {
            throw new Error('Недостаточно серебра для призового фонда и входного взноса');
        }
        await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [totalCost, userId]);
        const created = await client.query(
            `INSERT INTO tournaments
             (division, status, registrationstart, registrationend, prizepool, createdat, type, creatorid, entryfee, name, minlevel, maxlevel, basepool, maxplayers)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING id`,
            ['custom', 'registration', now, regEnd, prizePool + entryFee, new Date().toISOString(), 'custom', userId, entryFee, name, minLvl, maxLvl, prizePool, players]
        );
        const createdId = Number(created.rows[0].id);
        await client.query(
            'INSERT INTO tournament_participants (tournamentid, userid, snapshotstats) VALUES ($1, $2, $3)',
            [createdId, userId, JSON.stringify(snapshot)]
        );
        await client.query(
            'UPDATE users SET tournamentcount = tournamentcount + 1 WHERE id = $1',
            [userId]
        );
            return createdId;
        });
    } catch (error: any) {
        const message = error?.message || 'Ошибка создания турнира';
        const expected = /Недостаточно серебра/i.test(message);
        return res.status(expected ? 400 : 500).json({ error: message });
    }
    broadcast('tournamentCreated', { tournamentId, name });
    res.json({ success: true, tournamentId });
});

export default router;
