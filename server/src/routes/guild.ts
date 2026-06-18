import { Router } from 'express';
import { db } from '../db/index';
import { broadcast, sendToGuild } from '../websocket';
import { getDrinkBonuses } from '../game/drinks';
import { runBattle } from '../game/battle';
import { getBaseStats, enrichEquipment } from '../db/helpers';

const router = Router();

// Создать гильдию
router.post('/guild/create', async (req, res) => {
    const userId = req.userId;
    const { name, description, joinType } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите название гильдии' });
    if (!['open', 'request', 'invite'].includes(joinType || 'open')) return res.status(400).json({ error: 'Неверный тип вступления' });

    const existing = await db.one('SELECT id FROM guilds WHERE name = ?', [name.trim()]);
    if (existing) return res.status(400).json({ error: 'Гильдия с таким названием уже существует' });

    const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии. Покиньте текущую чтобы создать новую.' });

    const info = await db.run(
        'INSERT INTO guilds (name, description, leaderId, joinType) VALUES (?, ?, ?, ?)',
        [name.trim(), description || '', userId, joinType || 'open']
    );

    const guildId = info.lastInsertRowid;
    await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [guildId, userId, 'leader']);
    await db.run('UPDATE users SET guildId = ? WHERE id = ?', [guildId, userId]);

    res.json({ success: true, guildId: Number(guildId), name: name.trim() });
});

// Информация о моей гильдии
router.get('/guild/my', async (req, res) => {
    const userId = req.userId;
    const member = await db.one(
        'SELECT gm.*, g.name, g.description, g.image, g.joinType, g.level, g.exp, g.leaderId, g.treasury, g.taxRate, g.createdAt FROM guild_members gm JOIN guilds g ON gm.guildId = g.id WHERE gm.userId = ?',
        [userId]
    ) as any;
    if (!member) return res.json({ guild: null });

    const members = await db.query(
        'SELECT gm.userId, gm.rank, gm.joinedAt, u.username, u.level FROM guild_members gm JOIN users u ON gm.userId = u.id WHERE gm.guildId = ? ORDER BY gm.rank DESC, gm.joinedAt ASC',
        [member.guildId]
    );

    const inviteCount = await db.one(
        "SELECT COUNT(*) as cnt FROM guild_invites WHERE guildId = ? AND status = 'pending'",
        [member.guildId]
    ) as any;

    // Информация о войне
    const war = await isGuildAtWar(member.guildId);
    let warInfo = null;
    if (war) {
        const attackerGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [war.attackerGuildId]) as any;
        const defenderGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [war.defenderGuildId]) as any;
        warInfo = {
            id: war.id,
            attackerGuild: attackerGuild || { id: war.attackerGuildId, name: `Гильдия #${war.attackerGuildId}` },
            defenderGuild: defenderGuild || { id: war.defenderGuildId, name: `Гильдия #${war.defenderGuildId}` },
            status: war.status,
            declaredAt: war.declaredAt,
            acceptedAt: war.acceptedAt,
            expiresAt: war.expiresAt,
            isAttacker: war.attackerGuildId === member.guildId,
        };
    }

    res.json({
        guild: {
            id: member.guildId,
            name: member.name,
            description: member.description,
            image: member.image,
            joinType: member.joinType,
            level: member.level,
            exp: member.exp,
            leaderId: member.leaderId,
            treasury: member.treasury,
            taxRate: member.taxRate,
            createdAt: member.createdAt,
            myRank: member.rank,
            memberCount: members.length,
            pendingInvites: inviteCount.cnt,
        },
        members,
        war: warInfo,
    });
});

// Список гильдий (должен быть до /guild/:id)
router.get('/guild/list', async (req, res) => {
    const guilds = await db.query(`
        SELECT g.*, u.username as leaderName, u.id as leaderUserId,
            (SELECT COUNT(*) FROM guild_members WHERE guildId = g.id) as memberCount,
            (SELECT gw.status FROM guild_wars gw WHERE (gw.attackerGuildId = g.id OR gw.defenderGuildId = g.id) AND gw.status IN ('pending','active') LIMIT 1) as warStatus,
            (SELECT gw2.id FROM guild_wars gw2 WHERE (gw2.attackerGuildId = g.id OR gw2.defenderGuildId = g.id) AND gw2.status IN ('pending','active') LIMIT 1) as warId
        FROM guilds g
        JOIN users u ON g.leaderId = u.id
        ORDER BY g.treasury DESC, g.level DESC
        LIMIT 50
    `, []);

    // Дополнить war-инфой
    const result = await Promise.all((guilds as any[]).map(async (g) => {
        if (g.warId) {
            const war = await db.one(`SELECT gw.*, a.name as attackerName, d.name as defenderName FROM guild_wars gw JOIN guilds a ON gw.attackerGuildId = a.id JOIN guilds d ON gw.defenderGuildId = d.id WHERE gw.id = ?`, [g.warId]) as any;
            if (war) {
                const opponentName = war.attackerGuildId === g.id ? war.defenderName : war.attackerName;
                g.warStatus = war.status;
                g.warOpponent = opponentName;
            }
        }
        return g;
    }));

    res.json(result);
});

// Обновить настройки гильдии (только лидер)
router.post('/guild/settings', async (req, res) => {
    const userId = req.userId;
    const { joinType, description, image } = req.body;

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять настройки' });

    if (joinType && !['open', 'request', 'invite'].includes(joinType)) return res.status(400).json({ error: 'Неверный тип: open, request, invite' });

    if (joinType) {
        await db.run('UPDATE guilds SET joinType = ? WHERE id = ?', [joinType, member.guildId]);
    }
    if (description !== undefined) {
        await db.run('UPDATE guilds SET description = ? WHERE id = ?', [description, member.guildId]);
    }
    if (image !== undefined) {
        await db.run('UPDATE guilds SET image = ? WHERE id = ?', [image, member.guildId]);
    }

    const updated = await db.one('SELECT joinType, description, image FROM guilds WHERE id = ?', [member.guildId]) as any;
    const typeMsg = joinType ? `Тип: «${joinType === 'open' ? 'открытая' : joinType === 'request' ? 'по заявке' : 'закрытая'}»` : '';
    const descMsg = description !== undefined ? 'Описание обновлено' : '';
    const msg = [typeMsg, descMsg].filter(Boolean).join('. ');
    res.json({ success: true, ...updated, message: msg || 'Настройки обновлены' });
});

// Заявки на вступление (для лидера/офицеров)
router.get('/guild/requests', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const requests = await db.query(`
        SELECT gi.*, u.username
        FROM guild_invites gi
        JOIN users u ON gi.userId = u.id
        WHERE gi.guildId = ? AND gi.status = 'pending' AND gi.invitedBy = 0
        ORDER BY gi.createdAt DESC
    `, [member.guildId]);
    res.json(requests);
});

// Мои приглашения
router.get('/guild/invites', async (req, res) => {
    const userId = req.userId;
    const invites = await db.query(`
        SELECT gi.*, g.name as guildName, u.username as inviterName
        FROM guild_invites gi
        JOIN guilds g ON gi.guildId = g.id
        LEFT JOIN users u ON gi.invitedBy = u.id
        WHERE gi.userId = ? AND gi.status = 'pending'
        ORDER BY gi.createdAt DESC
    `, [userId]);
    res.json(invites);
});

// --- Гильд-чат ---
router.get('/guild/chat', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const guildId = member.guildId;
    const messages = await db.query(`
        SELECT m.*, u.username as senderName
        FROM chat_messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.targetId = ?
        ORDER BY m.createdAt DESC
        LIMIT 10
    `, [-guildId]);
    res.json(messages.reverse());
});

router.post('/guild/chat', async (req, res) => {
    const userId = req.userId;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Пустое сообщение' });

    const member = await db.one('SELECT guildId FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const guildId = member.guildId;
    const sender = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    const info = await db.run(
        'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)',
        [userId, -guildId, content]
    );

    const msg = {
        id: info.lastInsertRowid,
        senderId: userId,
        senderName: sender.username,
        targetId: -guildId,
        content,
        createdAt: new Date().toISOString(),
    };

    // Рассылаем всем членам гильдии
    const members = await db.query('SELECT userId FROM guild_members WHERE guildId = ?', [guildId]) as any[];
    const { broadcast } = require('../websocket');
    members.forEach((m: any) => {
        broadcast('message', { message: msg }, m.userId === userId ? undefined : undefined);
    });
    broadcast('message', { message: msg }, userId);

    res.json({ success: true, message: msg });
});

// Публичная информация о гильдии
router.get('/guild/:id', async (req, res, next) => {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) return next();
    const guild = await db.one('SELECT g.*, u.username as leaderName FROM guilds g JOIN users u ON g.leaderId = u.id WHERE g.id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });

    const members = await db.query(
        'SELECT gm.userId, gm.rank, gm.joinedAt, u.username, u.level FROM guild_members gm JOIN users u ON gm.userId = u.id WHERE gm.guildId = ? ORDER BY gm.rank DESC, gm.joinedAt ASC',
        [guildId]
    );

    const memberCount = members.length;

    // Информация о войне
    const war = await isGuildAtWar(guildId);
    let warInfo = null;
    if (war) {
        const attackerGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [war.attackerGuildId]) as any;
        const defenderGuild = await db.one('SELECT id, name FROM guilds WHERE id = ?', [war.defenderGuildId]) as any;
        warInfo = {
            id: war.id,
            attackerGuild: attackerGuild || { id: war.attackerGuildId, name: `Гильдия #${war.attackerGuildId}` },
            defenderGuild: defenderGuild || { id: war.defenderGuildId, name: `Гильдия #${war.defenderGuildId}` },
            status: war.status,
            declaredAt: war.declaredAt,
            acceptedAt: war.acceptedAt,
            expiresAt: war.expiresAt,
        };
    }

    res.json({ guild: { ...guild, memberCount }, members, war: warInfo });
});

// Вступить в открытую гильдию
router.post('/guild/join/:id', async (req, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.id);

    const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

    const guild = await db.one('SELECT * FROM guilds WHERE id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });
    if (guild.joinType !== 'open') return res.status(400).json({ error: 'Гильдия доступна только по заявке или приглашению' });

    await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [guildId, userId, 'member']);
    await db.run('UPDATE users SET guildId = ? WHERE id = ?', [guildId, userId]);

    res.json({ success: true });
});

// Подать заявку
router.post('/guild/request/:id', async (req, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.id);

    const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

    const guild = await db.one('SELECT * FROM guilds WHERE id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });
    if (guild.joinType !== 'request') return res.status(400).json({ error: 'Эта гильдия не принимает заявки' });

    const existing = await db.one(
        "SELECT id FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending'",
        [guildId, userId]
    );
    if (existing) return res.status(400).json({ error: 'Заявка уже отправлена' });

    await db.run('INSERT INTO guild_invites (guildId, userId, invitedBy) VALUES (?, ?, ?)', [guildId, userId, 0]);
    res.json({ success: true });
});

// Пригласить игрока (отправить ЛС)
router.post('/guild/invite', async (req, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не состоите в гильдии' });
    if (member.rank !== 'leader' && member.rank !== 'officer') return res.status(400).json({ error: 'Только лидер и офицеры могут приглашать' });

    const target = await db.one('SELECT id, username, guildId FROM users WHERE id = ?', [targetId]) as any;
    if (!target) return res.status(404).json({ error: 'Игрок не найден' });
    if (target.guildId) return res.status(400).json({ error: 'Игрок уже в гильдии' });

    const existing = await db.one(
        "SELECT id, createdAt FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending'",
        [member.guildId, targetId]
    ) as any;
    if (existing) {
        const now = Math.floor(Date.now() / 1000);
        const inviteTime = Math.floor(new Date(existing.createdAt + 'Z').getTime() / 1000);
        const elapsed = now - inviteTime;
        if (elapsed < 3600) {
            const remaining = Math.ceil((3600 - elapsed) / 60);
            return res.status(400).json({ error: `Приглашение уже отправлено. Повторно можно через ${remaining} мин` });
        }
        // Старое приглашение — отменяем
        await db.run("UPDATE guild_invites SET status = 'declined' WHERE id = ?", [existing.id]);
    }

    const guild = await db.one('SELECT name FROM guilds WHERE id = ?', [member.guildId]) as any;

    await db.run('INSERT INTO guild_invites (guildId, userId, invitedBy) VALUES (?, ?, ?)', [member.guildId, targetId, userId]);

    // ЛС с приглашением
    const inviter = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    const msg = `🏚️ ${inviter.username} приглашает вас в гильдию «${guild.name}». Нажмите чтобы принять.`;
    const info = await db.run('INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, ?, ?, ?)', [0, targetId, msg, JSON.stringify({ type: 'guild_invite', guildId: member.guildId, guildName: guild.name })]);

    broadcast('message', { message: {
        id: info.lastInsertRowid, senderId: 0, senderName: 'system', targetId,
        content: msg, createdAt: new Date().toISOString(),
        item: { type: 'guild_invite', guildId: member.guildId, guildName: guild.name },
    }});

    res.json({ success: true });
});

// Принять / отклонить приглашение (по guildId)
router.post('/guild/accept-invite', async (req, res) => {
    const userId = req.userId;
    const { guildId, accept } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Укажите guildId' });

    const invite = await db.one(
        "SELECT * FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
        [guildId, userId]
    ) as any;
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

    if (accept) {
        const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
        if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

        await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [guildId, userId, 'member']);
        await db.run('UPDATE users SET guildId = ? WHERE id = ?', [guildId, userId]);
        await db.run("UPDATE guild_invites SET status = 'accepted' WHERE guildId = ? AND userId = ? AND status = 'pending'", [guildId, userId]);
    } else {
        await db.run("UPDATE guild_invites SET status = 'declined' WHERE guildId = ? AND userId = ? AND status = 'pending'", [guildId, userId]);
    }

    res.json({ success: true });
});

// Принять / отклонить приглашение (по ID)
router.post('/guild/invite/:id', async (req, res) => {
    const userId = req.userId;
    const inviteId = parseInt(req.params.id);
    const { accept } = req.body; // true/false

    const invite = await db.one('SELECT * FROM guild_invites WHERE id = ? AND userId = ? AND status = ?', [inviteId, userId, 'pending']) as any;
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

    if (accept) {
        const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
        if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

        await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [invite.guildId, userId, 'member']);
        await db.run('UPDATE users SET guildId = ? WHERE id = ?', [invite.guildId, userId]);
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['accepted', inviteId]);
    } else {
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['declined', inviteId]);
    }

    // Удаляем другие pending приглашения для этого игрока
    if (accept) {
        await db.run("DELETE FROM guild_invites WHERE userId = ? AND id != ? AND status = 'pending'", [userId, inviteId]);
    }

    res.json({ success: true });
});

// Принять/отклонить заявку (для лидера/офицеров)
router.post('/guild/handle-request', async (req, res) => {
    const userId = req.userId;
    const { requestId, accept } = req.body;

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const invite = await db.one("SELECT * FROM guild_invites WHERE id = ? AND guildId = ? AND status = 'pending'", [requestId, member.guildId]) as any;
    if (!invite) return res.status(404).json({ error: 'Заявка не найдена' });

    if (accept) {
        const targetGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [invite.userId]) as any;
        if (targetGuild?.guildId) return res.status(400).json({ error: 'Игрок уже в гильдии' });

        await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [member.guildId, invite.userId, 'member']);
        await db.run('UPDATE users SET guildId = ? WHERE id = ?', [member.guildId, invite.userId]);
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['accepted', requestId]);
    } else {
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['declined', requestId]);
    }

    res.json({ success: true });
});

// Покинуть гильдию
router.post('/guild/leave', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    // Нельзя покинуть гильдию во время войны
    const war = await isGuildAtWar(member.guildId);
    if (war) return res.status(400).json({ error: 'Нельзя покинуть гильдию во время войны' });

    if (member.rank === 'leader') {
        const otherMembers = await db.one('SELECT COUNT(*) as cnt FROM guild_members WHERE guildId = ? AND userId != ?', [member.guildId, userId]) as any;
        if (otherMembers.cnt > 0) return res.status(400).json({ error: 'Передайте лидерство другому члену перед выходом' });
        await db.run('DELETE FROM guilds WHERE id = ?', [member.guildId]);
    }

    await db.run('DELETE FROM guild_members WHERE guildId = ? AND userId = ?', [member.guildId, userId]);
    await db.run('UPDATE users SET guildId = NULL WHERE id = ?', [userId]);

    res.json({ success: true });
});

// Исключить участника (лидер/офицер)
router.post('/guild/kick', async (req, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const actor = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!actor || (actor.rank !== 'leader' && actor.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const target = await db.one('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?', [actor.guildId, targetId]) as any;
    if (!target) return res.status(400).json({ error: 'Игрок не в гильдии' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Нельзя исключить лидера' });
    if (actor.rank === 'officer' && target.rank === 'officer') return res.status(400).json({ error: 'Офицер не может исключить другого офицера' });

    await db.run('DELETE FROM guild_members WHERE guildId = ? AND userId = ?', [actor.guildId, targetId]);
    await db.run('UPDATE users SET guildId = NULL WHERE id = ?', [targetId]);

    res.json({ success: true });
});

// Сменить роль участника (только лидер)
router.post('/guild/role', async (req, res) => {
    const userId = req.userId;
    const { targetId, rank } = req.body;
    if (!targetId || !rank) return res.status(400).json({ error: 'Укажите targetId и rank' });
    if (!['officer', 'member'].includes(rank)) return res.status(400).json({ error: 'Неверный ранг' });

    const actor = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!actor || actor.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять роли' });

    const target = await db.one('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?', [actor.guildId, targetId]) as any;
    if (!target) return res.status(400).json({ error: 'Игрок не в гильдии' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Нельзя изменить роль лидера' });

    await db.run('UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?', [rank, actor.guildId, targetId]);
    res.json({ success: true });
});

// Отменить все отправленные приглашения (лидер/офицер)
router.post('/guild/cancel-invites', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const info = await db.run(
        "UPDATE guild_invites SET status = 'declined' WHERE guildId = ? AND status = 'pending'",
        [member.guildId]
    );
    res.json({ success: true, cancelled: info.changes });
});

// --- Казна гильдии ---

// Внести серебро в казну
router.post('/guild/treasury/deposit', async (req, res) => {
    const userId = req.userId;
    const { amount } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Укажите сумму (минимум 1 серебра)' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    // Блокировка казны при войне (pending или active)
    const war = await isGuildAtWar(member.guildId);
    if (war) return res.status(400).json({ error: 'Казна заморожена на время войны' });

    // Проверяем баланс игрока
    const user = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;
    if (!user || user.money < amount) return res.status(400).json({ error: 'Недостаточно серебра в кармане' });

    try {
        const result = await db.tx(async (client) => {
            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [amount, userId]);
            await client.query('UPDATE guilds SET treasury = treasury + $1 WHERE id = $2', [amount, member.guildId]);
            await client.query('INSERT INTO guild_treasury_log (guildId, userId, amount, createdat) VALUES ($1, $2, $3, NOW())', [member.guildId, userId, amount]);
            const r = await client.query('SELECT treasury FROM guilds WHERE id = $1', [member.guildId]);
            return r.rows[0];
        });
        res.json({ success: true, treasury: result.treasury });
        // Guild quest progress — track donations
        updateGuildQuestProgress(member.guildId).catch(e => console.error('guildQuest donate:', e.message));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// История пополнений казны (с пагинацией и поиском)
router.get('/guild/treasury/history', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE l.guildId = ?';
    const params: any[] = [member.guildId];

    if (search) {
        whereClause += ' AND u.username LIKE ?';
        params.push(`%${search}%`);
    }

    const total = (await db.one(`SELECT COUNT(*) as cnt FROM guild_treasury_log l JOIN users u ON l.userId = u.id ${whereClause}`, params) as any).cnt;

    const logs = await db.query(`
        SELECT l.id, l.amount, l.type, l.createdAt, u.username
        FROM guild_treasury_log l
        JOIN users u ON l.userId = u.id
        ${whereClause}
        ORDER BY l.id DESC
        LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const treasury = (await db.one('SELECT treasury FROM guilds WHERE id = ?', [member.guildId]) as any)?.treasury || 0;
    res.json({ treasury, history: logs, total, page, totalPages: Math.ceil(total / limit) });
});

// --- Гильд-войны ---

// Проверить, в войне ли гильдия (с авто-закрытием просроченных)
async function isGuildAtWar(guildId: number): any | null {
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
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может объявить войну' });

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
            id: info.lastInsertRowid, senderId: 0, senderName: 'system', targetId: defenderLeader.id,
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
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может отвечать на войну' });

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

    // Лимит: 3 атаки на защитника
    const targetAttacks = (await db.one(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND defenderId = ?',
        [war.id, targetId]
    ) as any).cnt;
    if (targetAttacks >= 3) return res.status(400).json({ error: 'Этого игрока уже атаковали максимум раз (3)' });

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
router.post('/guild/tax-rate', async (req, res) => {
    const userId = req.userId;
    const { taxRate } = req.body;
    if (taxRate == null || taxRate < 0 || taxRate > 50) return res.status(400).json({ error: 'Ставка от 0 до 50%' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять налог' });

    await db.run('UPDATE guilds SET taxRate = ? WHERE id = ?', [taxRate, member.guildId]);
    res.json({ success: true, taxRate });
});

// ==================== Задания гильдии ====================

const GUILD_QUEST_TYPES = ['pve', 'pvp', 'craft', 'donate', 'jobs'] as const;
type GuildQuestType = typeof GUILD_QUEST_TYPES[number];

const GUILD_QUEST_INFO: Record<GuildQuestType, { name: string; desc: (req: number) => string; snapshotFields: string }> = {
    pve: { name: 'Истребление', desc: (r) => `Убить ${r} мобов (общий счёт гильдии)`, snapshotFields: 'pveWins' },
    pvp: { name: 'Кровь врагов', desc: (r) => `Одержать ${r} PvP-побед (общий счёт гильдии)`, snapshotFields: 'wins' },
    craft: { name: 'Кузня', desc: (r) => `Создать/улучшить ${r} предметов (общий счёт гильдии)`, snapshotFields: 'craftCount' },
    donate: { name: 'Казна', desc: (r) => `Пожертвовать ${r} серебра в казну`, snapshotFields: 'treasury' },
    jobs: { name: 'Труд', desc: (r) => `Накопить ${r} секунд работы (общий счёт гильдии)`, snapshotFields: 'totalJobSeconds' },
};

const GUILD_QUEST_DIFFICULTIES = {
    easy:   { label: '⭐ Простой',   xpMin: 1, xpMax: 3, reqMult: 1 },
    medium: { label: '⭐⭐ Средний',  xpMin: 4, xpMax: 6, reqMult: 3 },
    hard:   { label: '⭐⭐⭐ Сложный', xpMin: 7, xpMax: 10, reqMult: 8 },
} as const;

/** Обновить прогресс активного квеста гильдии и разослать по WS */
export async function updateGuildQuestProgress(guildId: number) {
    const activeQuest = await db.one(
        "SELECT * FROM guild_quests WHERE guildId = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        [guildId]
    ) as any;
    if (!activeQuest) return;

    const snap = JSON.parse(activeQuest.snapshot || '{}');
    const members = await db.query('SELECT userId FROM guild_members WHERE guildId = ?', [guildId]) as any[];
    const userIds = members.map((m: any) => m.userId);

    let currentValue = 0;
    if (activeQuest.questType === 'donate') {
        const g = await db.one('SELECT treasury FROM guilds WHERE id = ?', [guildId]) as any;
        currentValue = (g?.treasury || 0) - (snap.treasury || 0);
    } else {
        const field = GUILD_QUEST_INFO[activeQuest.questType as GuildQuestType]?.snapshotFields;
        if (field && userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');
            const rows = await db.query(
                `SELECT SUM(\"${field}\") as total FROM users WHERE id IN (${placeholders})`,
                userIds
            ) as any[];
            currentValue = (rows[0]?.total || 0) - (snap[field] || 0);
        }
    }

    const newProgress = Math.min(currentValue, activeQuest.requirement);
    if (newProgress !== activeQuest.progress) {
        await db.run('UPDATE guild_quests SET progress = ? WHERE id = ?', [newProgress, activeQuest.id]);
        activeQuest.progress = newProgress;
    }

    const info = GUILD_QUEST_INFO[activeQuest.questType as GuildQuestType];
    const questData = {
        ...activeQuest,
        typeName: info?.name || activeQuest.questType,
        description: info?.desc(activeQuest.requirement) || '',
        difficultyLabel: GUILD_QUEST_DIFFICULTIES[activeQuest.difficulty as keyof typeof GUILD_QUEST_DIFFICULTIES]?.label || activeQuest.difficulty,
    };

    sendToGuild(guildId, { type: 'guildQuestProgress', activeQuest: questData });
    return questData;
}

// Получить задания гильдии (3 случайных на выбор)
router.get('/guild/quest', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    // Активное задание — обновить прогресс и вернуть
    const questData = await updateGuildQuestProgress(member.guildId);
    if (questData) {
        return res.json({ activeQuest: questData, options: null });
    }

    // Нет активного — генерируем 3 варианта
    const options: any[] = [];
    const usedTypes = new Set<string>();
    for (let i = 0; i < 3; i++) {
        const availableTypes = GUILD_QUEST_TYPES.filter(t => !usedTypes.has(t));
        if (availableTypes.length === 0) break;
        const questType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        usedTypes.add(questType);

        const diffs = Object.keys(GUILD_QUEST_DIFFICULTIES);
        const difficulty = diffs[Math.floor(Math.random() * diffs.length)] as keyof typeof GUILD_QUEST_DIFFICULTIES;
        const d = GUILD_QUEST_DIFFICULTIES[difficulty];
        const rewardXp = Math.floor(Math.random() * (d.xpMax - d.xpMin + 1)) + d.xpMin;
        const baseReqs: Record<string, number> = { pve: 50, pvp: 10, craft: 10, donate: 500, jobs: 1800 };
        const requirement = (baseReqs[questType] || 50) * d.reqMult;
        const info = GUILD_QUEST_INFO[questType];

        options.push({
            questType, difficulty, requirement, rewardXp,
            typeName: info.name, description: info.desc(requirement),
            difficultyLabel: d.label,
        });
    }

    res.json({ activeQuest: null, options });
});

// Взять задание (лидер выбирает из предложенных)
router.post('/guild/quest/take', async (req, res) => {
    const userId = req.userId;
    const { questType, difficulty, requirement, rewardXp } = req.body;

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может управлять заданиями' });

    if (!questType || !difficulty || !requirement || !rewardXp) return res.status(400).json({ error: 'Выберите задание' });

    // Отменяем текущее активное
    await db.run("UPDATE guild_quests SET status = 'cancelled' WHERE guildId = ? AND status = 'active'", [member.guildId]);

    // Снапшот
    const members = await db.query('SELECT userId FROM guild_members WHERE guildId = ?', [member.guildId]) as any[];
    const userIds = members.map((m: any) => m.userId);
    const snapshot: any = {};

    const placeholders = userIds.map(() => '?').join(',');
    if (questType === 'donate') {
        const g = await db.one('SELECT treasury FROM guilds WHERE id = ?', [member.guildId]) as any;
        snapshot.treasury = g?.treasury || 0;
    } else if (userIds.length > 0) {
        const field = GUILD_QUEST_INFO[questType as GuildQuestType]?.snapshotFields;
        if (field) {
            const rows = await db.query(
                `SELECT SUM("${field}") as total FROM users WHERE id IN (${placeholders})`,
                userIds
            ) as any[];
            snapshot[field] = rows[0]?.total || 0;
        }
    }

    await db.run(
        'INSERT INTO guild_quests (guildId, questType, difficulty, requirement, rewardXp, snapshot) VALUES (?, ?, ?, ?, ?, ?)',
        [member.guildId, questType, difficulty, requirement, rewardXp, JSON.stringify(snapshot)]
    );

    res.json({ success: true, message: 'Задание взято!' });
});

// Забрать награду (лидер)
router.post('/guild/quest/claim', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может забирать награду' });

    const quest = await db.one(
        "SELECT * FROM guild_quests WHERE guildId = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        [member.guildId]
    ) as any;
    if (!quest) return res.status(400).json({ error: 'Нет активного задания' });
    if (quest.progress < quest.requirement) return res.status(400).json({ error: `Задание не выполнено: ${quest.progress}/${quest.requirement}` });

    await db.run("UPDATE guild_quests SET status = 'claimed' WHERE id = ?", [quest.id]);
    await db.run('UPDATE guilds SET exp = exp + ? WHERE id = ?', [quest.rewardXp, member.guildId]);

    res.json({ success: true, rewardXp: quest.rewardXp, message: `+${quest.rewardXp} опыта гильдии!` });
});

export default router;
