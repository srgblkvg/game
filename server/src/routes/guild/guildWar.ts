import { Router } from "express";
import { db } from "../../db/index";
import { broadcast, sendToGuild } from "../../events";
import { getDrinkBonuses } from "../../game/drinks";
import { runBattle } from "../../game/battle";
import { getBaseStats, enrichEquipment } from "../../db/helpers";
import { getGuildBonus } from "../../game/guildBuildings";

const router = Router();

export async function isGuildAtWar(guildId: number): Promise<any> {
    const now = new Date().toISOString();
    // Авто-отмена просроченных pending войн
    await db.run(
        `UPDATE guild_wars SET status = 'cancelled', endedAt = ? WHERE status = 'pending' AND expiresAt <= ?`,
        [now, now]
    );
    // Авто-завершение просроченных active войн (с переводом казны)
    const expiredWars = await db.query(
        `SELECT * FROM guild_wars WHERE status = 'active' AND expiresAt <= ?`,
        [now]
    ) as any[];

    for (const war of expiredWars) {
        const attackerScore = war.attackerScore || 0;
        const defenderScore = war.defenderScore || 0;

        let winnerId: number | null = null;
        let loserId: number | null = null;

        if (attackerScore > defenderScore) {
            winnerId = war.attackerGuildId;
            loserId = war.defenderGuildId;
        } else if (defenderScore > attackerScore) {
            winnerId = war.defenderGuildId;
            loserId = war.attackerGuildId;
        }

        // Перевести казну проигравшего победителю
        if (winnerId && loserId) {
            const loserTreasury = (await db.one('SELECT treasury FROM guilds WHERE id = ?', [loserId]) as any)?.treasury || 0;
            if (loserTreasury > 0) {
                await db.run('UPDATE guilds SET treasury = treasury + ? WHERE id = ?', [loserTreasury, winnerId]);
                await db.run('UPDATE guilds SET treasury = 0 WHERE id = ?', [loserId]);
                // Запись в лог казны
                await db.run('INSERT INTO guild_treasury_log (guildId, userId, amount, type, createdat) VALUES (?, ?, ?, ?, ?)', [winnerId, 0, loserTreasury, 'war_win', new Date().toISOString()]);
                await db.run('INSERT INTO guild_treasury_log (guildId, userId, amount, type, createdat) VALUES (?, ?, ?, ?, ?)', [loserId, 0, -loserTreasury, 'war_loss', new Date().toISOString()]);
            }
        }

        await db.run(
            `UPDATE guild_wars SET status = 'ended', endedAt = ?, winnerGuildId = ? WHERE id = ?`,
            [now, winnerId, war.id]
        );
    }
    return await db.one(
        `SELECT * FROM guild_wars WHERE (attackerGuildId = ? OR defenderGuildId = ?) AND status IN ('pending', 'active') LIMIT 1`,
        [guildId, guildId]
    ) as any || null;
}

// Объявить войну (только лидер)
router.post('/guild/war/declare', async (req, res) => {
    const userId = req.userId;
    const { targetGuildId } = req.body;
    if (!targetGuildId) return res.status(400).json({ error: 'Укажите targetGuildId' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && !(member.rank === 'officer' && member.can_war))) {
        return res.status(400).json({ error: 'Только лидер или офицер с правом на войну может объявить войну' });
    }

    const myGuildId = member.guildId;

    // Нельзя объявить войну себе
    if (myGuildId === targetGuildId) return res.status(400).json({ error: 'Нельзя объявить войну своей гильдии' });

    // Проверить, что целевая гильдия существует
    const targetGuild = await db.one('SELECT * FROM guilds WHERE id = ?', [targetGuildId]) as any;
    if (!targetGuild) return res.status(404).json({ error: 'Гильдия не найдена' });

    // Проверить, что моя гильдия не в войне
    const myWar = await isGuildAtWar(myGuildId);
    if (myWar) return res.status(400).json({ error: 'Ваша гильдия уже участвует в войне' });

    // Проверить, что целевая гильдия не в войне
    const theirWar = await isGuildAtWar(targetGuildId);
    if (theirWar) return res.status(400).json({ error: 'Целевая гильдия уже участвует в войне' });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    await db.run(
        'INSERT INTO guild_wars (attackerGuildId, defenderGuildId, declaredAt, expiresAt) VALUES (?, ?, ?, ?)',
        [myGuildId, targetGuildId, now.toISOString(), expiresAt]
    );

    const myGuild = await db.one('SELECT name FROM guilds WHERE id = ?', [myGuildId]) as any;

    // Уведомление лидеру защищающейся гильдии через ЛС
    const defenderLeader = await db.one(
        'SELECT u.id FROM guilds g JOIN users u ON g.leaderId = u.id WHERE g.id = ?',
        [targetGuildId]
    ) as any;
    if (defenderLeader) {
        const msg = `⚔️ Гильдия «${myGuild.name}» объявила вам войну! У вас 24 часа чтобы принять или отклонить. Страница гильдии →`;
        const info = await db.run(
            'INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, ?, ?, ?)',
            [0, defenderLeader.id, msg, JSON.stringify({ type: 'war_declared', attackerGuildId: myGuildId, attackerName: myGuild.name })]
        );
        broadcast('message', { message: {
            id: info.lastInsertRowid, senderId: 0, senderName: 'Глашатай', targetId: defenderLeader.id,
            content: msg, createdAt: new Date().toISOString(),
            item: { type: 'war_declared', attackerGuildId: myGuildId, attackerName: myGuild.name },
        }});
    }

    res.json({ success: true, message: `Война объявлена гильдии «${targetGuild.name}»` });
});

// Ответить на объявление войны (только лидер защищающейся гильдии)
router.post('/guild/war/respond', async (req, res) => {
    const userId = req.userId;
    const { accept } = req.body; // true — принять, false — отклонить

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && !(member.rank === 'officer' && member.can_war))) {
        return res.status(400).json({ error: 'Только лидер или офицер с правом на войну может отвечать на войну' });
    }

    const war = await db.one(
        `SELECT * FROM guild_wars WHERE defenderGuildId = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`,
        [member.guildId]
    ) as any;
    if (!war) return res.status(404).json({ error: 'Нет входящих объявлений войны' });

    const now = new Date().toISOString();

    if (accept) {
        const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await db.run('UPDATE guild_wars SET status = ?, acceptedAt = ?, expiresAt = ? WHERE id = ?', ['active', now, newExpiresAt, war.id]);
        res.json({ success: true, message: 'Война принята! Казна заморожена на 24 часа.' });
    } else {
        await db.run('UPDATE guild_wars SET status = ?, endedAt = ? WHERE id = ?', ['cancelled', now, war.id]);
        res.json({ success: true, message: 'Война отклонена.' });
    }
});

// Статус войны для моей гильдии
router.get('/guild/war/status', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.json({ war: null });

    const war = await isGuildAtWar(member.guildId);
    if (!war) return res.json({ war: null });

    const attackerGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [war.attackerGuildId]) as any;
    const defenderGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [war.defenderGuildId]) as any;

    const isAttacker = war.attackerGuildId === member.guildId;

    res.json({
        war: {
            id: war.id,
            attackerGuild: attackerGuild,
            defenderGuild: defenderGuild,
            status: war.status,
            declaredAt: war.declaredAt,
            acceptedAt: war.acceptedAt,
            expiresAt: war.expiresAt,
            isAttacker,
            isDefender: !isAttacker,
            attackerScore: war.attackerScore || 0,
            defenderScore: war.defenderScore || 0,
        }
    });
});

// Детали войны: участники, атаки, счёт
router.get('/guild/war/details', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const war = await isGuildAtWar(member.guildId);
    if (!war || war.status !== 'active') return res.json({ war: null });

    const myGuildId = member.guildId;
    const enemyGuildId = war.attackerGuildId === myGuildId ? war.defenderGuildId : war.attackerGuildId;

    const myGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [myGuildId]) as any;
    const enemyGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [enemyGuildId]) as any;

    // Участники моей гильдии (только кто был в гильдии на момент объявления войны)
    const myMembers = await db.query(`
        SELECT u.id, u.username, u.level,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND attackerId = u.id) as attacksMade,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND attackerId = u.id AND won = 1) as attacksWon,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND attackerId = u.id AND won = 0) as attacksLost,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND defenderId = u.id AND won = 0) as timesAttacked
        FROM guild_members gm JOIN users u ON gm.userId = u.id
        WHERE gm.guildId = ? AND gm.joinedAt <= (SELECT declaredAt::timestamptz FROM guild_wars WHERE id = ?)
        ORDER BY gm.rank DESC, u.level DESC
    `, [war.id, war.id, war.id, war.id, myGuildId, war.id]) as any[];

    // Участники вражеской гильдии (с проверкой защиты, только до войны)
    const now = new Date().toISOString();
    const enemyMembers = await db.query(`
        SELECT u.id, u.username, u.level,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND defenderId = u.id) as timesAttacked,
            (SELECT MAX(createdAt) FROM guild_war_attacks WHERE warId = ? AND defenderId = u.id) as lastAttackedAt
        FROM guild_members gm JOIN users u ON gm.userId = u.id
        WHERE gm.guildId = ? AND gm.joinedAt <= (SELECT declaredAt::timestamptz FROM guild_wars WHERE id = ?)
        ORDER BY u.level DESC
    `, [war.id, war.id, enemyGuildId, war.id]) as any[];

    // Проверка защиты: если атаковали меньше часа назад — возвращаем unixtime окончания защиты
    const enemyWithProtection = enemyMembers.map((m) => {
        let protectedUntil = null;
        if (m.lastAttackedAt) {
            const attackedTime = new Date(m.lastAttackedAt).getTime();
            const protectionEnd = attackedTime + 60 * 60 * 1000;
            if (protectionEnd > Date.now()) {
                protectedUntil = Math.floor(protectionEnd / 1000);
            }
        }
        return { ...m, protectedUntil };
    });

    // Мои атаки
    const myAttacks = await db.query(`
        SELECT gwa.*, u.username as defenderName
        FROM guild_war_attacks gwa
        JOIN users u ON gwa.defenderId = u.id
        WHERE gwa.warId = ? AND gwa.attackerId = ?
        ORDER BY gwa.id DESC
    `, [war.id, userId]) as any[];

    // Все атаки в войне (для хода войны)
    const allAttacks = await db.query(`
        SELECT gwa.*, au.username as attackerName, du.username as defenderName
        FROM guild_war_attacks gwa
        JOIN users au ON gwa.attackerId = au.id
        JOIN users du ON gwa.defenderId = du.id
        WHERE gwa.warId = ?
        ORDER BY gwa.id DESC
    `, [war.id]) as any[];

    // Сколько атак я сделал
    const myAttackCount = await db.one(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?',
        [war.id, userId]
    ) as any;

    // Время последней моей атаки — кулдаун 5 минут (unixtime)
    const myLastAttack = await db.one(
        'SELECT MAX(createdAt) as lastAt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?',
        [war.id, userId]
    ) as any;

    let attackCooldownUntil: number | null = null;
    if (myLastAttack?.lastAt) {
        const lastTime = new Date(myLastAttack.lastAt).getTime();
        const cooldownEnd = lastTime + 5 * 60 * 1000;
        if (cooldownEnd > Date.now()) {
            attackCooldownUntil = Math.floor(cooldownEnd / 1000);
        }
    }

    res.json({
        war: {
            id: war.id,
            myGuild,
            enemyGuild,
            status: war.status,
            expiresAt: war.expiresAt,
            attackerScore: war.attackerScore || 0,
            defenderScore: war.defenderScore || 0,
            myGuildId,
            enemyGuildId,
            attackerGuildId: war.attackerGuildId,
            myMembers,
            enemyMembers: enemyWithProtection,
            myAttacks,
            allAttacks,
            myAttackCount: myAttackCount.cnt,
            canAttack: myAttackCount.cnt < 3 && !attackCooldownUntil,
            attackCooldownUntil,
        }
    });
});

// Атаковать участника вражеской гильдии
router.post('/guild/war/attack', async (req, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const war = await isGuildAtWar(member.guildId);
    if (!war || war.status !== 'active') return res.status(400).json({ error: 'Ваша гильдия не в активной войне' });

    const myGuildId = member.guildId;
    const enemyGuildId = war.attackerGuildId === myGuildId ? war.defenderGuildId : war.attackerGuildId;

    // Проверка: цель во вражеской гильдии
    const targetMember = await db.one('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?', [enemyGuildId, targetId]) as any;
    if (!targetMember) return res.status(400).json({ error: 'Цель не во вражеской гильдии' });

    // Проверка: атакующий был в гильдии на момент объявления войны
    if (member.joinedAt > war.declaredAt) return res.status(400).json({ error: 'Вы вступили в гильдию после объявления войны' });

    // Проверка: цель была во вражеской гильдии на момент объявления войны
    if (targetMember.joinedAt > war.declaredAt) return res.status(400).json({ error: 'Цель вступила в гильдию после объявления войны' });

    // Лимит: 3 атаки на атакующего
    const myAttacks = (await db.one(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?',
        [war.id, userId]
    ) as any).cnt;
    if (myAttacks >= 3) return res.status(400).json({ error: 'Вы исчерпали лимит атак (3)' });

    // Лимит: 5 атак на защитника
    const targetAttacks = (await db.one(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND defenderId = ?',
        [war.id, targetId]
    ) as any).cnt;
    if (targetAttacks >= 5) return res.status(400).json({ error: 'Этого игрока уже атаковали максимум раз (5)' });

    // Кулдаун: 5 минут с последней атаки
    const lastAttack = await db.one(
        'SELECT MAX(createdAt) as lastAt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?',
        [war.id, userId]
    ) as any;
    if (lastAttack?.lastAt) {
        const lastTime = new Date(lastAttack.lastAt).getTime();
        if (Date.now() - lastTime < 5 * 60 * 1000) {
            return res.status(400).json({ error: 'Атаковать можно раз в 5 минут' });
        }
    }

    // Защита цели: 1 час после любой атаки на неё
    const lastDefend = await db.one(
        'SELECT MAX(createdAt) as lastAt FROM guild_war_attacks WHERE warId = ? AND defenderId = ?',
        [war.id, targetId]
    ) as any;
    if (lastDefend?.lastAt) {
        const lastTime = new Date(lastDefend.lastAt).getTime();
        if (Date.now() - lastTime < 60 * 60 * 1000) {
            return res.status(400).json({ error: 'У игрока защита после атаки (1 час)' });
        }
    }

    // Симуляция боя (макс HP + все бонусы, full combat как в PvP)
    const attacker = await db.one('SELECT u.id, u.username, u.level, u.baseS, u.baseA, u.baseD, u.baseM, u.equipment, u.money, u.activeDrink, u.drinkUntil FROM users u WHERE u.id = ?', [userId]) as any;
    const defender = await db.one('SELECT u.id, u.username, u.level, u.baseS, u.baseA, u.baseD, u.baseM, u.equipment, u.money, u.activeDrink, u.drinkUntil FROM users u WHERE u.id = ?', [targetId]) as any;

    const aCollCnt = (await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]) as any).cnt || 0;
    const dCollCnt = (await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [targetId]) as any).cnt || 0;

    const aEquip = JSON.parse(attacker.equipment || '{}');
    const dEquip = JSON.parse(defender.equipment || '{}');
    const { enriched: aEnriched } = await enrichEquipment(aEquip);
    const { enriched: dEnriched } = await enrichEquipment(dEquip);

    const attackerData = {
        id: attacker.id,
        name: attacker.username,
        base: getBaseStats(attacker),
        equipment: aEnriched,
        level: attacker.level,
        money: attacker.money || 0,
        drinkBonuses: getDrinkBonuses(attacker),
        collectionBonus: aCollCnt,
    };
    const defenderData = {
        id: defender.id,
        name: defender.username,
        base: getBaseStats(defender),
        equipment: dEnriched,
        level: defender.level,
        money: defender.money || 0,
        drinkBonuses: getDrinkBonuses(defender),
        collectionBonus: dCollCnt,
    };

    const result = runBattle(attackerData, defenderData);
    const won = result.winnerId === attacker.id;
    const log = result.log;
    const steps = result.steps;


    // В гильдийских войнах деньги не снимаются — убираем шаги кражи
    const warSteps = steps.filter((s: any) => s.type !== "money");
    const warLog = warSteps.map((s: any) => s.message);

    // Запись атаки
    await db.run(`
        INSERT INTO guild_war_attacks (warId, attackerId, defenderId, attackerGuildId, defenderGuildId, won, battleLog, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [war.id, userId, targetId, myGuildId, enemyGuildId, won ? 1 : 0, JSON.stringify(warSteps), new Date().toISOString()]);

    // Обновление счёта
    if (won) {
        const scoreField = myGuildId === war.attackerGuildId ? 'attackerScore' : 'defenderScore';
        await db.run(`UPDATE guild_wars SET ${scoreField} = ${scoreField} + 1 WHERE id = ?`, [war.id]);
    }

    res.json({
        success: true,
        won,
        log: warLog,
        steps: warSteps,
        finalAttackerHp: result.attackerHpAfter,
        finalDefenderHp: result.defenderHpAfter,
    });
});

// Установить ставку налога (только лидер)

export default router;
