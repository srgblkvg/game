// server/src/game/massacre.ts — боевая логика Резни
import { db } from '../db/index';
import { pushNotification, markDirty } from '../events';
import { applyExp } from '../db/helpers';
import { checkAchievement } from '../routes/achievements';
import { sendLeaderboardLevel } from '../vkLeaderboard';
import {
    dodgeChance, critChance, critMult, blockChance, blockReduction,
    counterChance, stunChance, rollDamage, BattleStep, runTurn, TurnContext
} from './battle';
import { CharStats } from './stats';
import { updateGuildQuestProgress } from '../routes/guild/guildQuests';

// Импортируем runTurn из battle.ts для единой механики

export async function runMassacreBattle(eventId: number): Promise<void> {
    // Загрузить участников — через raw чтобы обойти pgLowerIdentifiers
    const rawResult = await db.raw(
        `SELECT mp.*, u.username FROM massacre_participants mp JOIN users u ON mp.user_id = u.id WHERE mp.event_id = $1 AND mp.alive = TRUE`,
        [eventId]
    );
    const participants = rawResult.rows as any[];

    if (participants.length < 2) {
        // Недостаточно участников — отменяем, возвращаем деньги
        const event = await db.one('SELECT entry_fee FROM massacre_events WHERE id = ?', [eventId]) as any;
        const refund = event?.entry_fee || 10;
        for (const p of participants) {
            await db.run('UPDATE users SET money = money + ? WHERE id = ?', [refund, p.user_id]);
        }
        await db.run(`UPDATE massacre_events SET status = 'cancelled' WHERE id = ?`, [eventId]);
        // Уведомить единственного участника
        if (participants.length === 1) {
            pushNotification(participants[0].user_id, {
                type: 'battle_result',
                message: 'Резня отменена: недостаточно участников. Взнос возвращён.',
                data: { eventId, cancelled: true },
            });
        }
        return;
    }

    // Сортировка по ловкости (A) DESC
    participants.sort((a, b) => b.base_a - a.base_a);
    const turnOrder = participants.map(p => p.user_id);
    await db.run(`UPDATE massacre_events SET turn_order = ? WHERE id = ?`, [JSON.stringify(turnOrder), eventId]);

    // Карта участников: userId -> state
    const state = new Map<number, { hp: number; maxHp: number; stunned: boolean; alive: boolean; name: string; level: number; stats: CharStats }>();
    for (const p of participants) {
        const stats: CharStats = JSON.parse(p.stats_json || '{}');
        state.set(p.user_id, {
            hp: p.hp_current, maxHp: p.hp_max, stunned: p.stunned, alive: p.alive,
            name: p.username, level: p.level,
            stats,
        });
    }

    let turnNum = 0;
    let battleLog: string[] = [];

    // Цикл пока >1 живых
    while (state.size > 0 && Array.from(state.values()).filter(s => s.alive).length > 1) {
        for (const [userId, s] of state) {
            if (!s.alive) continue;

            // Проверяем: остался ли ещё кто-то живой кроме этого
            const aliveCount = Array.from(state.values()).filter(x => x.alive).length;
            if (aliveCount <= 1) break;

            turnNum++;

            // Оглушение — пропуск хода
            if (s.stunned) {
                await db.run(
                    `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, action_type, message)
                     VALUES (?, ?, ?, ?, 'stunned_skip', ?)`,
                    [eventId, turnNum, userId, s.name, `${s.name} оглушён и пропускает ход`]
                );
                s.stunned = false;
                continue;
            }

            // Выбрать случайную живую цель (не себя)
            const targets = Array.from(state.entries()).filter(([id, t]) => t.alive && id !== userId);
            if (targets.length === 0) break;
            const entry = targets[Math.floor(Math.random() * targets.length)]!;
            const targetId = entry[0];
            const target = entry[1];

            // Статы атакующего и цели — из сохранённого снимка (с экипировкой, напитками, гильдией)
            const atkStats = s.stats;
            const defStats = target.stats;

            // Один ход
            const ctx: TurnContext = {
                actorName: s.name, targetName: target.name,
                actorStats: atkStats, targetStats: defStats,
                actorLevel: s.level,
                hpActor: s.hp, hpTarget: target.hp,
                maxHpActor: s.maxHp, maxHpTarget: target.maxHp,
                actor: 'attacker', target: 'defender',
            };
            const steps: BattleStep[] = [];
            const result = runTurn(ctx, (step) => steps.push(step));

            // Применить урон
            s.hp = result.hpActor;
            target.hp = result.hpTarget;

            // Записать шаги в БД (с HP для отладки)
            for (const step of steps) {
                // При контратаке actor='defender' (защитник атакует), target='attacker' (урон в атакующего)
                const stepActorId = step.actor === 'defender' ? targetId : userId;
                const stepActorName = step.actor === 'defender' ? target.name : s.name;
                const stepTargetId = step.target === 'attacker' ? userId : (step.target === 'defender' ? targetId : null);
                const stepTargetName = step.target === 'attacker' ? s.name : (step.target === 'defender' ? target.name : null);

                const hpInfo = ` [${s.name} ${s.hp}/${s.maxHp} | ${target.name} ${target.hp}/${target.maxHp}]`;
                await db.run(
                    `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, target_id, target_name, action_type, damage, message)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [eventId, turnNum, stepActorId, stepActorName, stepTargetId, stepTargetName, step.type, step.damage || 0, step.message + hpInfo]
                );
            }

            // Проверить смерть атакующего (мог умереть от контратаки/вампиризма)
            if (s.hp <= 0) {
                s.alive = false;
                s.hp = 0;
                await db.run(
                    `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, action_type, damage, message)
                     VALUES (?, ?, ?, ?, 'death', 0, ?)`,
                    [eventId, turnNum, userId, s.name, `${s.name} пал от ответного удара ${target.name}! [${s.name} 0/${s.maxHp}]`]
                );
                continue; // пропускаем остальную обработку для этого умершего
            }

            // Проверить смерть цели
            if (target.hp <= 0) {
                target.alive = false;
                target.hp = 0;
                await db.run(
                    `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, target_id, target_name, action_type, damage, message)
                     VALUES (?, ?, ?, ?, ?, ?, 'death', 0, ?)`,
                    [eventId, turnNum, userId, s.name, targetId, target.name, `${target.name} пал от руки ${s.name}! [${target.name} 0/${target.maxHp}]`]
                );

                // Засчитать PvP-победу убийце (для квестов)
                await db.run(
                    `INSERT INTO battles (attackerId, defenderId, winnerId, log, steps, attackerHpAfter, defenderHpAfter)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, targetId, userId, '[]', '[]', s.hp, 0]
                );
                await db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [userId]);
                const killerGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]).catch(() => null) as any;
                if (killerGuild?.guildId) {
                    updateGuildQuestProgress(killerGuild.guildId).catch(e => console.error('[massacre] guildQuest kill:', e.message));
                }
                markDirty(userId, 'quests');
            }

            // Проверить оглушение
            if (result.stunnedTarget) {
                target.stunned = true;
            }

            // Если остался 1 — стоп
            if (Array.from(state.values()).filter(x => x.alive).length <= 1) break;
        }
    }

    // Найти победителя
    const winnerEntry = Array.from(state.entries()).find(([_, s]) => s.alive);
    if (!winnerEntry) {
        await db.run(`UPDATE massacre_events SET status = 'finished' WHERE id = ?`, [eventId]);
        return;
    }
    const [winnerId, winnerState] = winnerEntry;

    // Записать победу
    await db.run(
        `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, action_type, message)
         VALUES (?, ?, ?, ?, 'victory', ?)`,
        [eventId, turnNum + 1, winnerId, winnerState.name, `${winnerState.name} — победитель резни!`]
    );

    // Призовой фонд
    const eventFee = await db.one('SELECT entry_fee FROM massacre_events WHERE id = ?', [eventId]).catch(() => null) as any;
    const entryFee = eventFee?.entry_fee || 10;
    const prizePool = participants.length * entryFee;

    // Награда победителю: +10 XP и весь сбор
    const winner = await db.one('SELECT exp, level, statPoints, oauthProvider, oauthId FROM users WHERE id = ?', [winnerId]) as any;
    const expGain = 10;
    const { newExp, newLevel, levelsGained, newStatPoints } = applyExp(winnerId, expGain, winner.exp || 0, winner.level || 1, winner.statPoints || 0);
    await db.run('UPDATE users SET money = money + ?, exp = ?, level = ?, statPoints = ? WHERE id = ?',
        [prizePool, newExp, newLevel, newStatPoints, winnerId]);

    // VK Leaderboard
    if (levelsGained > 0 && winner.oauthProvider === 'vk' && winner.oauthId) {
        sendLeaderboardLevel(winnerId, newLevel, String(winner.oauthId)).catch(() => {});
    }

    // Обновить статус события
    await db.run(`UPDATE massacre_events SET status = 'finished' WHERE id = ?`, [eventId]);

    // Сохранить финальное HP участников
    for (const [userId, s] of state) {
        await db.run(
            `UPDATE massacre_participants SET hp_current = ?, alive = ?, stunned = ? WHERE event_id = ? AND user_id = ?`,
            [s.hp, s.alive, s.stunned, eventId, userId]
        );
        // Достижение за выживание в резне
        if (s.alive) {
            checkAchievement(userId, 'massacre').catch(() => {});
        }
    }

    // Разослать уведомления ВСЕМ участникам
    for (const [userId] of state) {
        pushNotification(userId, {
            type: 'battle_result',
            message: `Резня завершена! Победитель: ${winnerState.name}. Участников: ${participants.length}. Приз: ${prizePool} сер. +10 XP.`,
            data: JSON.stringify({ eventId, participantCount: participants.length, winnerName: winnerState.name, winnerId, prizePool, path: `/massacre?eventId=${eventId}` }),
        });
    }
}
