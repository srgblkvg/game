// server/src/game/massacre.ts — боевая логика Резни
import { db } from '../db/index';
import { pushNotification } from '../events';
import {
    dodgeChance, critChance, critMult, blockChance, blockReduction,
    counterChance, stunChance, rollDamage, BattleStep
} from './battle';
import { CharStats } from './stats';

// Импортируем типы/функции которых нет в экспорте battle.ts
function runTurnLocal(
    actorName: string, targetName: string,
    actorStats: CharStats, targetStats: CharStats,
    actorLevel: number,
    hpActor: number, hpTarget: number,
    maxHpActor: number, maxHpTarget: number,
): { hpActor: number; hpTarget: number; stunnedTarget: boolean; steps: BattleStep[] } {
    let hpA = hpActor;
    let hpT = hpTarget;
    let stunned = false;
    const steps: BattleStep[] = [];

    const addStep = (s: BattleStep) => steps.push(s);

    addStep({ type: 'attack', actor: 'attacker', message: `${actorName} атакует ${targetName}!` });

    if (Math.random() < dodgeChance(targetStats, actorStats)) {
        addStep({ type: 'dodge', actor: 'defender', message: `${targetName} уклоняется!` });
        if (Math.random() < counterChance(targetStats, actorStats, targetStats.extra.counter || 0)) {
            addStep({ type: 'counter', actor: 'defender', message: `${targetName} контратакует!` });
            let cdmg = targetStats.s;
            if (Math.random() < critChance(targetStats)) {
                cdmg *= critMult(targetStats);
                addStep({ type: 'crit', actor: 'defender', message: 'Крит!' });
            }
            cdmg = Math.max(0, Math.round(cdmg));
            hpA = Math.max(0, hpA - cdmg);
            addStep({ type: 'damage', actor: 'defender', target: 'attacker', damage: cdmg, message: `${targetName} наносит ${cdmg} урона!` });
        }
        return { hpActor: hpA, hpTarget: hpT, stunnedTarget: false, steps };
    }

    // Попадание
    let dmg = rollDamage(actorStats, actorLevel);
    if (Math.random() < critChance(actorStats)) {
        dmg *= critMult(actorStats);
        addStep({ type: 'crit', actor: 'attacker', message: 'Крит!' });
    }
    const fb = (targetStats.extra.fullBlock || 0);
    if (Math.random() < fb / (fb + 300)) {
        dmg = 0;
        addStep({ type: 'fullBlock', actor: 'defender', message: 'ПОЛНЫЙ БЛОК!' });
    } else if (Math.random() < blockChance(targetStats)) {
        const blocked = dmg * blockReduction(targetStats, actorStats);
        dmg -= blocked;
        addStep({ type: 'block', actor: 'defender', message: `Блок (-${Math.round(blocked)})` });
    }
    dmg = Math.max(0, Math.round(dmg));
    hpT = Math.max(0, hpT - dmg);
    addStep({ type: 'damage', actor: 'attacker', target: 'defender', damage: dmg, message: `${actorName} наносит ${dmg} урона!` });

    if (dmg > 0 && Math.random() < stunChance(actorStats, targetStats)) {
        stunned = true;
        addStep({ type: 'stun', actor: 'attacker', message: `${targetName} оглушён!` });
    }

    return { hpActor: hpA, hpTarget: hpT, stunnedTarget: stunned, steps };
}

export async function runMassacreBattle(eventId: number): Promise<void> {
    // Загрузить участников
    const participants = await db.query(
        `SELECT mp.*, u.username FROM massacre_participants mp JOIN users u ON mp.user_id = u.id WHERE mp.event_id = ? AND mp.alive = TRUE`,
        [eventId]
    ) as any[];

    if (participants.length < 2) {
        // Недостаточно участников — отменяем, возвращаем деньги
        for (const p of participants) {
            await db.run('UPDATE users SET money = money + ? WHERE id = ?', [100, p.user_id]);
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
            const result = runTurnLocal(
                s.name, target.name,
                atkStats, defStats,
                s.level,
                s.hp, target.hp,
                s.maxHp, target.maxHp,
            );

            // Применить урон
            s.hp = result.hpActor;
            target.hp = result.hpTarget;

            // Записать шаги в БД
            for (const step of result.steps) {
                await db.run(
                    `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, target_id, target_name, action_type, damage, message)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [eventId, turnNum, userId, s.name, targetId, target.name, step.type, step.damage || 0, step.message]
                );
            }

            // Проверить смерть цели
            if (target.hp <= 0) {
                target.alive = false;
                await db.run(
                    `INSERT INTO massacre_turns (event_id, turn_number, actor_id, actor_name, target_id, target_name, action_type, damage, message)
                     VALUES (?, ?, ?, ?, ?, ?, 'death', 0, ?)`,
                    [eventId, turnNum, userId, s.name, targetId, target.name, `${target.name} пал от руки ${s.name}!`]
                );
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
    const prizePool = participants.length * 100;

    // Награда победителю: +10 XP и весь сбор
    await db.run('UPDATE users SET money = money + ?, exp = exp + ? WHERE id = ?', [prizePool, 10, winnerId]);

    // Обновить статус события
    await db.run(`UPDATE massacre_events SET status = 'finished' WHERE id = ?`, [eventId]);

    // Сохранить финальное HP участников
    for (const [userId, s] of state) {
        await db.run(
            `UPDATE massacre_participants SET hp_current = ?, alive = ?, stunned = ? WHERE event_id = ? AND user_id = ?`,
            [s.hp, s.alive, s.stunned, eventId, userId]
        );
    }

    // Разослать уведомления ВСЕМ участникам
    for (const [userId] of state) {
        pushNotification(userId, {
            type: 'battle_result',
            message: `Резня завершена! Победитель: ${winnerState.name}. Участников: ${participants.length}. Приз: ${prizePool} сер. +10 XP.`,
            data: { eventId, participantCount: participants.length, winnerName: winnerState.name, winnerId, prizePool, path: '/history?tab=massacre' },
        });
    }
}
