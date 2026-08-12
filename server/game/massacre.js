"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMassacreBattle = runMassacreBattle;
// server/src/game/massacre.ts — боевая логика Резни
const index_1 = require("../db/index");
const events_1 = require("../events");
const helpers_1 = require("../db/helpers");
const achievements_1 = require("../routes/achievements");
const vkLeaderboard_1 = require("../vkLeaderboard");
const battle_1 = require("./battle");
const guildQuests_1 = require("../routes/guild/guildQuests");
// Импортируем runTurn из battle.ts для единой механики
async function runMassacreBattle(eventId) {
    // Загрузить участников — через raw чтобы обойти pgLowerIdentifiers
    const rawResult = await index_1.db.raw(`SELECT mp.*, u.username FROM massacre_participants mp JOIN users u ON mp.user_id = u.id WHERE mp.event_id = $1 AND mp.alive = TRUE`, [eventId]);
    const participants = rawResult.rows;
    if (participants.length < 2) {
        // Недостаточно участников — отменяем, возвращаем деньги
        const event = await index_1.db.one('SELECT entry_fee FROM massacre_events WHERE id = ?', [eventId]);
        const refund = event?.entry_fee || 10;
        for (const p of participants) {
            await index_1.db.run('UPDATE users SET money = money + ? WHERE id = ?', [refund, p.user_id]);
        }
        await index_1.db.run(`UPDATE massacre_events SET status = 'cancelled' WHERE id = ?`, [eventId]);
        // Уведомить единственного участника
        if (participants.length === 1) {
            (0, events_1.pushNotification)(participants[0].user_id, {
                type: 'battle_result',
                message: 'Кровавая лотерея отменена: недостаточно участников. Взнос возвращён.',
                data: { eventId, cancelled: true },
            });
        }
        return;
    }
    // Случайный порядок ходов — без привязки к ловкости
    // shuffle participants array
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    const turnOrder = participants.map(p => p.user_id);
    await index_1.db.run(`UPDATE massacre_events SET turn_order = ? WHERE id = ?`, [JSON.stringify(turnOrder), eventId]);
    // Карта участников: userId -> state
    const state = new Map();
    for (const p of participants) {
        const stats = JSON.parse(p.stats_json || '{}');
        state.set(p.user_id, {
            hp: p.hp_current, maxHp: p.hp_max, stunned: p.stunned, alive: p.alive,
            name: p.username, level: p.level,
            stats,
        });
    }
    let turnNum = 0;
    let lastAttackerId = null;
    // Цикл пока >1 живых — каждый ход случайный атакующий (не тот же дважды подряд)
    while (true) {
        const aliveEntries = Array.from(state.entries()).filter(([_, s]) => s.alive);
        if (aliveEntries.length <= 1)
            break;
        // Выбрать случайного атакующего, но не того же что на прошлом ходу (если >1 живых)
        const candidates = aliveEntries.filter(([id]) => id !== lastAttackerId);
        const pickFrom = candidates.length > 0 ? candidates : aliveEntries;
        const [userId, s] = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        lastAttackerId = userId;
        turnNum++;
        // Оглушение — пропуск хода
        if (s.stunned) {
            await index_1.db.run(`INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, action_type, message)
                 VALUES (?, ?, ?, ?, 'stunned_skip', ?)`, [eventId, turnNum, userId, s.name, `${s.name} оглушён и пропускает ход`]);
            s.stunned = false;
            continue;
        }
        // Выбрать случайную живую цель (не себя)
        const aliveTargets = Array.from(state.entries())
            .filter(([id, t]) => t.alive && id !== userId);
        if (aliveTargets.length === 0)
            break;
        const entry = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
        const targetId = entry[0];
        const target = entry[1];
        // Статы атакующего и цели — из сохранённого снимка (с экипировкой, напитками, гильдией)
        const atkStats = s.stats;
        const defStats = target.stats;
        // Один ход
        const ctx = {
            actorName: s.name, targetName: target.name,
            actorStats: atkStats, targetStats: defStats,
            actorLevel: s.level,
            hpActor: s.hp, hpTarget: target.hp,
            maxHpActor: s.maxHp, maxHpTarget: target.maxHp,
            actor: 'attacker', target: 'defender',
        };
        const steps = [];
        const result = (0, battle_1.runTurn)(ctx, (step) => steps.push(step));
        // Применить урон
        s.hp = result.hpActor;
        target.hp = result.hpTarget;
        // Записать шаги в БД (HP только для шагов с уроном)
        for (const step of steps) {
            const stepActorId = step.actor === 'defender' ? targetId : userId;
            const stepActorName = step.actor === 'defender' ? target.name : s.name;
            const stepTargetId = step.target === 'attacker' ? userId : (step.target === 'defender' ? targetId : null);
            const stepTargetName = step.target === 'attacker' ? s.name : (step.target === 'defender' ? target.name : null);
            // HP показываем только на шагах с уроном
            let hpInfo = '';
            if (step.type === 'damage') {
                const hp1 = step.hp1 != null ? step.hp1 : s.hp;
                const hp2 = step.hp2 != null ? step.hp2 : target.hp;
                const max1 = step.maxHp1 ?? s.maxHp;
                const max2 = step.maxHp2 ?? target.maxHp;
                hpInfo = ` [${s.name} ${hp1}/${max1} | ${target.name} ${hp2}/${max2}]`;
            }
            await index_1.db.run(`INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, target_id, target_name, action_type, damage, message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [eventId, turnNum, stepActorId, stepActorName, stepTargetId, stepTargetName, step.type, step.damage || 0, step.message + hpInfo]);
        }
        // Проверить смерть атакующего (мог умереть от контратаки/вампиризма)
        if (s.hp <= 0) {
            s.alive = false;
            s.hp = 0;
            await index_1.db.run(`INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, action_type, damage, message)
                 VALUES (?, ?, ?, ?, 'death', 0, ?)`, [eventId, turnNum, userId, s.name, `${s.name} пал от ответного удара ${target.name}! [${s.name} 0/${s.maxHp}]`]);
            continue; // пропускаем остальную обработку для этого умершего
        }
        // Проверить смерть цели
        if (target.hp <= 0) {
            target.alive = false;
            target.hp = 0;
            await index_1.db.run(`INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, target_id, target_name, action_type, damage, message)
                 VALUES (?, ?, ?, ?, ?, ?, 'death', 0, ?)`, [eventId, turnNum, userId, s.name, targetId, target.name, `${target.name} пал от руки ${s.name}! [${target.name} 0/${target.maxHp}]`]);
            // Засчитать PvP-победу убийце (для квестов)
            await index_1.db.run(`INSERT INTO battles (attackerId, defenderId, winnerId, log, steps, attackerHpAfter, defenderHpAfter)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`, [userId, targetId, userId, '[]', '[]', s.hp, 0]);
            await index_1.db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [userId]);
            const killerGuild = await index_1.db.one('SELECT guildId FROM users WHERE id = ?', [userId]).catch(() => null);
            if (killerGuild?.guildId) {
                (0, guildQuests_1.updateGuildQuestProgress)(killerGuild.guildId, 'pvp').catch(e => console.error('[massacre] guildQuest kill:', e.message));
            }
            (0, events_1.markDirty)(userId, 'quests');
        }
        // Проверить оглушение
        if (result.stunnedTarget) {
            target.stunned = true;
        }
    }
    // Найти победителя
    const winnerEntry = Array.from(state.entries()).find(([_, s]) => s.alive);
    if (!winnerEntry) {
        await index_1.db.run(`UPDATE massacre_events SET status = 'finished' WHERE id = ?`, [eventId]);
        return;
    }
    const [winnerId, winnerState] = winnerEntry;
    // Записать победу
    await index_1.db.run(`INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, action_type, message)
         VALUES (?, ?, ?, ?, 'victory', ?)`, [eventId, turnNum + 1, winnerId, winnerState.name, `${winnerState.name} — победитель кровавой лотереи!`]);
    // Призовой фонд: сборы + временный бонус 1000
    const eventFee = await index_1.db.one('SELECT entry_fee FROM massacre_events WHERE id = ?', [eventId]).catch(() => null);
    const entryFee = eventFee?.entry_fee || 10;
    const prizePool = participants.length * entryFee + 1000;
    // Награда победителю: +10 XP и весь сбор
    const winner = await index_1.db.one('SELECT exp, level, statPoints, oauthProvider, oauthId FROM users WHERE id = ?', [winnerId]);
    const expGain = 10;
    const { newExp, newLevel, levelsGained, newStatPoints } = (0, helpers_1.applyExp)(winnerId, expGain, winner.exp || 0, winner.level || 1, winner.statPoints || 0);
    await index_1.db.run('UPDATE users SET money = money + ?, exp = ?, level = ?, statPoints = ? WHERE id = ?', [prizePool, newExp, newLevel, newStatPoints, winnerId]);
    // VK Leaderboard
    if (levelsGained > 0 && winner.oauthProvider === 'vk' && winner.oauthId) {
        (0, vkLeaderboard_1.sendLeaderboardLevel)(winnerId, newLevel, String(winner.oauthId)).catch(() => { });
    }
    // Обновить статус события
    await index_1.db.run(`UPDATE massacre_events SET status = 'finished' WHERE id = ?`, [eventId]);
    // Сохранить финальное HP участников
    for (const [userId, s] of state) {
        await index_1.db.run(`UPDATE massacre_participants SET hp_current = ?, alive = ?, stunned = ? WHERE event_id = ? AND user_id = ?`, [s.hp, s.alive, s.stunned, eventId, userId]);
        // Достижение за выживание в резне
        if (s.alive) {
            (0, achievements_1.checkAchievement)(userId, 'massacre').catch(() => { });
        }
    }
    // Разослать уведомления ВСЕМ участникам
    for (const [userId] of state) {
        (0, events_1.pushNotification)(userId, {
            type: 'battle_result',
            message: `Кровавая лотерея завершена! Победитель: ${winnerState.name}. Участников: ${participants.length}. Приз: ${prizePool} сер. +10 XP.`,
            data: JSON.stringify({ eventId, participantCount: participants.length, winnerName: winnerState.name, winnerId, prizePool, path: `/massacre?eventId=${eventId}` }),
        });
    }
}
//# sourceMappingURL=massacre.js.map