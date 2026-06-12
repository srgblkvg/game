import { Router } from 'express';
import db from '../database';
import { broadcast } from '../websocket';

const router = Router();

// Создать гильдию
router.post('/guild/create', (req: any, res) => {
    const userId = req.userId;
    const { name, description, joinType } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите название гильдии' });
    if (!['open', 'request', 'invite'].includes(joinType || 'open')) return res.status(400).json({ error: 'Неверный тип вступления' });

    const existing = db.prepare('SELECT id FROM guilds WHERE name = ?').get(name.trim());
    if (existing) return res.status(400).json({ error: 'Гильдия с таким названием уже существует' });

    const alreadyInGuild = db.prepare('SELECT guildId FROM users WHERE id = ?').get(userId) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии. Покиньте текущую чтобы создать новую.' });

    const info = db.prepare(
        'INSERT INTO guilds (name, description, leaderId, joinType) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), description || '', userId, joinType || 'open');

    const guildId = info.lastInsertRowid;
    db.prepare('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)').run(guildId, userId, 'leader');
    db.prepare('UPDATE users SET guildId = ? WHERE id = ?').run(guildId, userId);

    res.json({ success: true, guildId: Number(guildId), name: name.trim() });
});

// Информация о моей гильдии
router.get('/guild/my', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare(
        'SELECT gm.*, g.name, g.description, g.joinType, g.level, g.exp, g.leaderId, g.treasury, g.taxRate, g.createdAt FROM guild_members gm JOIN guilds g ON gm.guildId = g.id WHERE gm.userId = ?'
    ).get(userId) as any;
    if (!member) return res.json({ guild: null });

    const members = db.prepare(
        'SELECT gm.userId, gm.rank, gm.joinedAt, u.username, u.level FROM guild_members gm JOIN users u ON gm.userId = u.id WHERE gm.guildId = ? ORDER BY gm.rank DESC, gm.joinedAt ASC'
    ).all(member.guildId);

    const inviteCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM guild_invites WHERE guildId = ? AND status = 'pending'"
    ).get(member.guildId) as any;

    // Информация о войне
    const war = isGuildAtWar(member.guildId);
    let warInfo = null;
    if (war) {
        const attackerGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(war.attackerGuildId) as any;
        const defenderGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(war.defenderGuildId) as any;
        warInfo = {
            id: war.id,
            attackerGuild,
            defenderGuild,
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
router.get('/guild/list', (req: any, res) => {
    const guilds = db.prepare(`
        SELECT g.*, u.username as leaderName, u.id as leaderUserId,
            (SELECT COUNT(*) FROM guild_members WHERE guildId = g.id) as memberCount,
            (SELECT gw.status FROM guild_wars gw WHERE (gw.attackerGuildId = g.id OR gw.defenderGuildId = g.id) AND gw.status IN ('pending','active') LIMIT 1) as warStatus,
            (SELECT gw2.id FROM guild_wars gw2 WHERE (gw2.attackerGuildId = g.id OR gw2.defenderGuildId = g.id) AND gw2.status IN ('pending','active') LIMIT 1) as warId
        FROM guilds g
        JOIN users u ON g.leaderId = u.id
        ORDER BY g.treasury DESC, g.level DESC
        LIMIT 50
    `).all();

    // Дополнить war-инфой
    const result = (guilds as any[]).map((g: any) => {
        if (g.warId) {
            const war = db.prepare(`SELECT gw.*, a.name as attackerName, d.name as defenderName FROM guild_wars gw JOIN guilds a ON gw.attackerGuildId = a.id JOIN guilds d ON gw.defenderGuildId = d.id WHERE gw.id = ?`).get(g.warId) as any;
            if (war) {
                const opponentName = war.attackerGuildId === g.id ? war.defenderName : war.attackerName;
                g.warStatus = war.status;
                g.warOpponent = opponentName;
            }
        }
        return g;
    });

    res.json(result);
});

// Заявки на вступление (для лидера/офицеров)
router.get('/guild/requests', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const requests = db.prepare(`
        SELECT gi.*, u.username
        FROM guild_invites gi
        JOIN users u ON gi.userId = u.id
        WHERE gi.guildId = ? AND gi.status = 'pending' AND gi.invitedBy = 0
        ORDER BY gi.createdAt DESC
    `).all(member.guildId);
    res.json(requests);
});

// Мои приглашения
router.get('/guild/invites', (req: any, res) => {
    const userId = req.userId;
    const invites = db.prepare(`
        SELECT gi.*, g.name as guildName, u.username as inviterName
        FROM guild_invites gi
        JOIN guilds g ON gi.guildId = g.id
        LEFT JOIN users u ON gi.invitedBy = u.id
        WHERE gi.userId = ? AND gi.status = 'pending'
        ORDER BY gi.createdAt DESC
    `).all(userId);
    res.json(invites);
});

// --- Гильд-чат ---
router.get('/guild/chat', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT guildId FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const guildId = member.guildId;
    const messages = db.prepare(`
        SELECT m.*, u.username as senderName
        FROM chat_messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.targetId = ?
        ORDER BY m.createdAt DESC
        LIMIT 10
    `).all(-guildId);
    res.json(messages.reverse());
});

router.post('/guild/chat', (req: any, res) => {
    const userId = req.userId;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Пустое сообщение' });

    const member = db.prepare('SELECT guildId FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const guildId = member.guildId;
    const sender = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
    const info = db.prepare(
        'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)'
    ).run(userId, -guildId, content);

    const msg = {
        id: info.lastInsertRowid,
        senderId: userId,
        senderName: sender.username,
        targetId: -guildId,
        content,
        createdAt: new Date().toISOString(),
    };

    // Рассылаем всем членам гильдии
    const members = db.prepare('SELECT userId FROM guild_members WHERE guildId = ?').all(guildId) as any[];
    const { broadcast } = require('../websocket');
    members.forEach((m: any) => {
        broadcast('message', { message: msg }, m.userId === userId ? undefined : undefined);
    });
    broadcast('message', { message: msg }, userId);

    res.json({ success: true, message: msg });
});

// Публичная информация о гильдии
router.get('/guild/:id', (req: any, res) => {
    const guildId = parseInt(req.params.id);
    const guild = db.prepare('SELECT g.*, u.username as leaderName FROM guilds g JOIN users u ON g.leaderId = u.id WHERE g.id = ?').get(guildId) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });

    const members = db.prepare(
        'SELECT gm.userId, gm.rank, gm.joinedAt, u.username, u.level FROM guild_members gm JOIN users u ON gm.userId = u.id WHERE gm.guildId = ? ORDER BY gm.rank DESC, gm.joinedAt ASC'
    ).all(guildId);

    const memberCount = members.length;

    // Информация о войне
    const war = isGuildAtWar(guildId);
    let warInfo = null;
    if (war) {
        const attackerGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(war.attackerGuildId) as any;
        const defenderGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(war.defenderGuildId) as any;
        warInfo = {
            id: war.id,
            attackerGuild,
            defenderGuild,
            status: war.status,
            declaredAt: war.declaredAt,
            acceptedAt: war.acceptedAt,
            expiresAt: war.expiresAt,
        };
    }

    res.json({ guild: { ...guild, memberCount }, members, war: warInfo });
});

// Вступить в открытую гильдию
router.post('/guild/join/:id', (req: any, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.id);

    const alreadyInGuild = db.prepare('SELECT guildId FROM users WHERE id = ?').get(userId) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

    const guild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });
    if (guild.joinType !== 'open') return res.status(400).json({ error: 'Гильдия доступна только по заявке или приглашению' });

    db.prepare('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)').run(guildId, userId, 'member');
    db.prepare('UPDATE users SET guildId = ? WHERE id = ?').run(guildId, userId);

    res.json({ success: true });
});

// Подать заявку
router.post('/guild/request/:id', (req: any, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.id);

    const alreadyInGuild = db.prepare('SELECT guildId FROM users WHERE id = ?').get(userId) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

    const guild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });
    if (guild.joinType !== 'request') return res.status(400).json({ error: 'Эта гильдия не принимает заявки' });

    const existing = db.prepare(
        "SELECT id FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending'"
    ).get(guildId, userId);
    if (existing) return res.status(400).json({ error: 'Заявка уже отправлена' });

    db.prepare('INSERT INTO guild_invites (guildId, userId, invitedBy) VALUES (?, ?, ?)').run(guildId, userId, 0);
    res.json({ success: true });
});

// Пригласить игрока (отправить ЛС)
router.post('/guild/invite', (req: any, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не состоите в гильдии' });
    if (member.rank !== 'leader' && member.rank !== 'officer') return res.status(400).json({ error: 'Только лидер и офицеры могут приглашать' });

    const target = db.prepare('SELECT id, username, guildId FROM users WHERE id = ?').get(targetId) as any;
    if (!target) return res.status(404).json({ error: 'Игрок не найден' });
    if (target.guildId) return res.status(400).json({ error: 'Игрок уже в гильдии' });

    const existing = db.prepare(
        "SELECT id, createdAt FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending'"
    ).get(member.guildId, targetId) as any;
    if (existing) {
        const now = Math.floor(Date.now() / 1000);
        const inviteTime = Math.floor(new Date(existing.createdAt + 'Z').getTime() / 1000);
        const elapsed = now - inviteTime;
        if (elapsed < 3600) {
            const remaining = Math.ceil((3600 - elapsed) / 60);
            return res.status(400).json({ error: `Приглашение уже отправлено. Повторно можно через ${remaining} мин` });
        }
        // Старое приглашение — отменяем
        db.prepare("UPDATE guild_invites SET status = 'declined' WHERE id = ?").run(existing.id);
    }

    const guild = db.prepare('SELECT name FROM guilds WHERE id = ?').get(member.guildId) as any;

    db.prepare('INSERT INTO guild_invites (guildId, userId, invitedBy) VALUES (?, ?, ?)').run(member.guildId, targetId, userId);

    // ЛС с приглашением
    const inviter = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
    const msg = `🏚️ ${inviter.username} приглашает вас в гильдию «${guild.name}». Нажмите чтобы принять.`;
    const info = db.prepare('INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, ?, ?, ?)').run(0, targetId, msg, JSON.stringify({ type: 'guild_invite', guildId: member.guildId, guildName: guild.name }));

    broadcast('message', { message: {
        id: info.lastInsertRowid, senderId: 0, senderName: 'system', targetId,
        content: msg, createdAt: new Date().toISOString(),
        item: { type: 'guild_invite', guildId: member.guildId, guildName: guild.name },
    }});

    res.json({ success: true });
});

// Принять / отклонить приглашение (по guildId)
router.post('/guild/accept-invite', (req: any, res) => {
    const userId = req.userId;
    const { guildId, accept } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Укажите guildId' });

    const invite = db.prepare(
        "SELECT * FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
    ).get(guildId, userId) as any;
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

    if (accept) {
        const alreadyInGuild = db.prepare('SELECT guildId FROM users WHERE id = ?').get(userId) as any;
        if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

        db.prepare('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)').run(guildId, userId, 'member');
        db.prepare('UPDATE users SET guildId = ? WHERE id = ?').run(guildId, userId);
        db.prepare("UPDATE guild_invites SET status = 'accepted' WHERE guildId = ? AND userId = ? AND status = 'pending'").run(guildId, userId);
    } else {
        db.prepare("UPDATE guild_invites SET status = 'declined' WHERE guildId = ? AND userId = ? AND status = 'pending'").run(guildId, userId);
    }

    res.json({ success: true });
});

// Принять / отклонить приглашение (по ID)
router.post('/guild/invite/:id', (req: any, res) => {
    const userId = req.userId;
    const inviteId = parseInt(req.params.id);
    const { accept } = req.body; // true/false

    const invite = db.prepare('SELECT * FROM guild_invites WHERE id = ? AND userId = ? AND status = ?').get(inviteId, userId, 'pending') as any;
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

    if (accept) {
        const alreadyInGuild = db.prepare('SELECT guildId FROM users WHERE id = ?').get(userId) as any;
        if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

        db.prepare('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)').run(invite.guildId, userId, 'member');
        db.prepare('UPDATE users SET guildId = ? WHERE id = ?').run(invite.guildId, userId);
        db.prepare('UPDATE guild_invites SET status = ? WHERE id = ?').run('accepted', inviteId);
    } else {
        db.prepare('UPDATE guild_invites SET status = ? WHERE id = ?').run('declined', inviteId);
    }

    // Удаляем другие pending приглашения для этого игрока
    if (accept) {
        db.prepare("DELETE FROM guild_invites WHERE userId = ? AND id != ? AND status = 'pending'").run(userId, inviteId);
    }

    res.json({ success: true });
});

// Принять/отклонить заявку (для лидера/офицеров)
router.post('/guild/handle-request', (req: any, res) => {
    const userId = req.userId;
    const { requestId, accept } = req.body;

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const invite = db.prepare("SELECT * FROM guild_invites WHERE id = ? AND guildId = ? AND status = 'pending'").get(requestId, member.guildId) as any;
    if (!invite) return res.status(404).json({ error: 'Заявка не найдена' });

    if (accept) {
        const targetGuild = db.prepare('SELECT guildId FROM users WHERE id = ?').get(invite.userId) as any;
        if (targetGuild?.guildId) return res.status(400).json({ error: 'Игрок уже в гильдии' });

        db.prepare('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)').run(member.guildId, invite.userId, 'member');
        db.prepare('UPDATE users SET guildId = ? WHERE id = ?').run(member.guildId, invite.userId);
        db.prepare('UPDATE guild_invites SET status = ? WHERE id = ?').run('accepted', requestId);
    } else {
        db.prepare('UPDATE guild_invites SET status = ? WHERE id = ?').run('declined', requestId);
    }

    res.json({ success: true });
});

// Покинуть гильдию
router.post('/guild/leave', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    if (member.rank === 'leader') {
        const otherMembers = db.prepare('SELECT COUNT(*) as cnt FROM guild_members WHERE guildId = ? AND userId != ?').get(member.guildId, userId) as any;
        if (otherMembers.cnt > 0) return res.status(400).json({ error: 'Передайте лидерство другому члену перед выходом' });
        db.prepare('DELETE FROM guilds WHERE id = ?').run(member.guildId);
    }

    db.prepare('DELETE FROM guild_members WHERE guildId = ? AND userId = ?').run(member.guildId, userId);
    db.prepare('UPDATE users SET guildId = NULL WHERE id = ?').run(userId);

    res.json({ success: true });
});

// Исключить участника (лидер/офицер)
router.post('/guild/kick', (req: any, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const actor = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!actor || (actor.rank !== 'leader' && actor.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const target = db.prepare('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?').get(actor.guildId, targetId) as any;
    if (!target) return res.status(400).json({ error: 'Игрок не в гильдии' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Нельзя исключить лидера' });
    if (actor.rank === 'officer' && target.rank === 'officer') return res.status(400).json({ error: 'Офицер не может исключить другого офицера' });

    db.prepare('DELETE FROM guild_members WHERE guildId = ? AND userId = ?').run(actor.guildId, targetId);
    db.prepare('UPDATE users SET guildId = NULL WHERE id = ?').run(targetId);

    res.json({ success: true });
});

// Сменить роль участника (только лидер)
router.post('/guild/role', (req: any, res) => {
    const userId = req.userId;
    const { targetId, rank } = req.body;
    if (!targetId || !rank) return res.status(400).json({ error: 'Укажите targetId и rank' });
    if (!['officer', 'member'].includes(rank)) return res.status(400).json({ error: 'Неверный ранг' });

    const actor = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!actor || actor.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять роли' });

    const target = db.prepare('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?').get(actor.guildId, targetId) as any;
    if (!target) return res.status(400).json({ error: 'Игрок не в гильдии' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Нельзя изменить роль лидера' });

    db.prepare('UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?').run(rank, actor.guildId, targetId);
    res.json({ success: true });
});

// Отменить все отправленные приглашения (лидер/офицер)
router.post('/guild/cancel-invites', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const info = db.prepare(
        "UPDATE guild_invites SET status = 'declined' WHERE guildId = ? AND status = 'pending'"
    ).run(member.guildId);
    res.json({ success: true, cancelled: info.changes });
});

// --- Казна гильдии ---

// Внести серебро в казну
router.post('/guild/treasury/deposit', (req: any, res) => {
    const userId = req.userId;
    const { amount } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Укажите сумму (минимум 1 серебра)' });

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    // Блокировка казны при войне (pending или active)
    const war = isGuildAtWar(member.guildId);
    if (war) return res.status(400).json({ error: 'Казна заморожена на время войны' });

    // Проверяем баланс игрока
    const user = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.money < amount) return res.status(400).json({ error: 'Недостаточно серебра в кармане' });

    const tx = db.transaction(() => {
        db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(amount, userId);
        db.prepare('UPDATE guilds SET treasury = treasury + ? WHERE id = ?').run(amount, member.guildId);
        db.prepare('INSERT INTO guild_treasury_log (guildId, userId, amount) VALUES (?, ?, ?)').run(member.guildId, userId, amount);
        return db.prepare('SELECT treasury FROM guilds WHERE id = ?').get(member.guildId) as any;
    });

    try {
        const result = tx();
        res.json({ success: true, treasury: result.treasury });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// История пополнений казны (с пагинацией и поиском)
router.get('/guild/treasury/history', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
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

    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM guild_treasury_log l JOIN users u ON l.userId = u.id ${whereClause}`).get(...params) as any).cnt;

    const logs = db.prepare(`
        SELECT l.id, l.amount, l.type, l.createdAt, u.username
        FROM guild_treasury_log l
        JOIN users u ON l.userId = u.id
        ${whereClause}
        ORDER BY l.id DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const treasury = (db.prepare('SELECT treasury FROM guilds WHERE id = ?').get(member.guildId) as any)?.treasury || 0;
    res.json({ treasury, history: logs, total, page, totalPages: Math.ceil(total / limit) });
});

// --- Гильд-войны ---

// Проверить, в войне ли гильдия (с авто-закрытием просроченных)
function isGuildAtWar(guildId: number): any | null {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // Авто-отмена просроченных pending войн
    db.prepare(
        `UPDATE guild_wars SET status = 'cancelled', endedAt = ? WHERE status = 'pending' AND expiresAt <= ?`
    ).run(now, now);
    // Авто-завершение просроченных active войн
    db.prepare(
        `UPDATE guild_wars SET status = 'ended', endedAt = ? WHERE status = 'active' AND expiresAt <= ?`
    ).run(now, now);
    return db.prepare(
        `SELECT * FROM guild_wars WHERE (attackerGuildId = ? OR defenderGuildId = ?) AND status IN ('pending', 'active') LIMIT 1`
    ).get(guildId, guildId) as any || null;
}

// Объявить войну (только лидер)
router.post('/guild/war/declare', (req: any, res) => {
    const userId = req.userId;
    const { targetGuildId } = req.body;
    if (!targetGuildId) return res.status(400).json({ error: 'Укажите targetGuildId' });

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может объявить войну' });

    const myGuildId = member.guildId;

    // Нельзя объявить войну себе
    if (myGuildId === targetGuildId) return res.status(400).json({ error: 'Нельзя объявить войну своей гильдии' });

    // Проверить, что целевая гильдия существует
    const targetGuild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(targetGuildId) as any;
    if (!targetGuild) return res.status(404).json({ error: 'Гильдия не найдена' });

    // Проверить, что моя гильдия не в войне
    const myWar = isGuildAtWar(myGuildId);
    if (myWar) return res.status(400).json({ error: 'Ваша гильдия уже участвует в войне' });

    // Проверить, что целевая гильдия не в войне
    const theirWar = isGuildAtWar(targetGuildId);
    if (theirWar) return res.status(400).json({ error: 'Целевая гильдия уже участвует в войне' });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    db.prepare(
        'INSERT INTO guild_wars (attackerGuildId, defenderGuildId, expiresAt) VALUES (?, ?, ?)'
    ).run(myGuildId, targetGuildId, expiresAt);

    const myGuild = db.prepare('SELECT name FROM guilds WHERE id = ?').get(myGuildId) as any;

    // Уведомление лидеру защищающейся гильдии через ЛС
    const defenderLeader = db.prepare(
        'SELECT u.id FROM guilds g JOIN users u ON g.leaderId = u.id WHERE g.id = ?'
    ).get(targetGuildId) as any;
    if (defenderLeader) {
        const msg = `⚔️ Гильдия «${myGuild.name}» объявила вам войну! У вас 24 часа чтобы принять или отклонить. Страница гильдии →`;
        const info = db.prepare(
            'INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, ?, ?, ?)'
        ).run(0, defenderLeader.id, msg, JSON.stringify({ type: 'war_declared', attackerGuildId: myGuildId, attackerName: myGuild.name }));
        broadcast('message', { message: {
            id: info.lastInsertRowid, senderId: 0, senderName: 'system', targetId: defenderLeader.id,
            content: msg, createdAt: new Date().toISOString(),
            item: { type: 'war_declared', attackerGuildId: myGuildId, attackerName: myGuild.name },
        }});
    }

    res.json({ success: true, message: `Война объявлена гильдии «${targetGuild.name}»` });
});

// Ответить на объявление войны (только лидер защищающейся гильдии)
router.post('/guild/war/respond', (req: any, res) => {
    const userId = req.userId;
    const { accept } = req.body; // true — принять, false — отклонить

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может отвечать на войну' });

    const war = db.prepare(
        `SELECT * FROM guild_wars WHERE defenderGuildId = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`
    ).get(member.guildId) as any;
    if (!war) return res.status(404).json({ error: 'Нет входящих объявлений войны' });

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (accept) {
        const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
        db.prepare('UPDATE guild_wars SET status = ?, acceptedAt = ?, expiresAt = ? WHERE id = ?').run('active', now, newExpiresAt, war.id);
        res.json({ success: true, message: 'Война принята! Казна заморожена на 24 часа.' });
    } else {
        db.prepare('UPDATE guild_wars SET status = ?, endedAt = ? WHERE id = ?').run('cancelled', now, war.id);
        res.json({ success: true, message: 'Война отклонена.' });
    }
});

// Статус войны для моей гильдии
router.get('/guild/war/status', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT guildId FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.json({ war: null });

    const war = isGuildAtWar(member.guildId);
    if (!war) return res.json({ war: null });

    const attackerGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(war.attackerGuildId) as any;
    const defenderGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(war.defenderGuildId) as any;

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
router.get('/guild/war/details', (req: any, res) => {
    const userId = req.userId;
    const member = db.prepare('SELECT guildId FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const war = isGuildAtWar(member.guildId);
    if (!war || war.status !== 'active') return res.json({ war: null });

    const myGuildId = member.guildId;
    const enemyGuildId = war.attackerGuildId === myGuildId ? war.defenderGuildId : war.attackerGuildId;

    const myGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(myGuildId) as any;
    const enemyGuild = db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(enemyGuildId) as any;

    // Участники моей гильдии
    const myMembers = db.prepare(`
        SELECT u.id, u.username, u.level,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND attackerId = u.id) as attacksMade,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND defenderId = u.id AND won = 0) as timesAttacked
        FROM guild_members gm JOIN users u ON gm.userId = u.id
        WHERE gm.guildId = ?
        ORDER BY gm.rank DESC, u.level DESC
    `).all(war.id, war.id, myGuildId) as any[];

    // Участники вражеской гильдии (с проверкой защиты)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const enemyMembers = db.prepare(`
        SELECT u.id, u.username, u.level,
            (SELECT COUNT(*) FROM guild_war_attacks WHERE warId = ? AND defenderId = u.id) as timesAttacked,
            (SELECT MAX(createdAt) FROM guild_war_attacks WHERE warId = ? AND defenderId = u.id AND won = 0) as lastAttackedAt
        FROM guild_members gm JOIN users u ON gm.userId = u.id
        WHERE gm.guildId = ?
        ORDER BY u.level DESC
    `).all(war.id, war.id, enemyGuildId) as any[];

    // Проверка защиты: если атаковали меньше часа назад
    const enemyWithProtection = enemyMembers.map((m: any) => {
        let protectedUntil = null;
        if (m.lastAttackedAt) {
            const attackedTime = new Date(m.lastAttackedAt + 'Z').getTime();
            const protectionEnd = attackedTime + 60 * 60 * 1000;
            if (protectionEnd > Date.now()) {
                protectedUntil = new Date(protectionEnd).toISOString();
            }
        }
        return { ...m, protectedUntil };
    });

    // Мои атаки
    const myAttacks = db.prepare(`
        SELECT gwa.*, u.username as defenderName
        FROM guild_war_attacks gwa
        JOIN users u ON gwa.defenderId = u.id
        WHERE gwa.warId = ? AND gwa.attackerId = ?
        ORDER BY gwa.id DESC
    `).all(war.id, userId) as any[];

    // Сколько атак я сделал
    const myAttackCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?'
    ).get(war.id, userId) as any;

    // Время последней моей атаки
    const myLastAttack = db.prepare(
        'SELECT MAX(createdAt) as lastAt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?'
    ).get(war.id, userId) as any;

    let attackCooldownUntil = null;
    if (myLastAttack?.lastAt) {
        const lastTime = new Date(myLastAttack.lastAt + 'Z').getTime();
        const cooldownEnd = lastTime + 5 * 60 * 1000;
        if (cooldownEnd > Date.now()) {
            attackCooldownUntil = new Date(cooldownEnd).toISOString();
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
            myAttackCount: myAttackCount.cnt,
            canAttack: myAttackCount.cnt < 3 && !attackCooldownUntil,
            attackCooldownUntil,
        }
    });
});

// Атаковать участника вражеской гильдии
router.post('/guild/war/attack', (req: any, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member) return res.status(400).json({ error: 'Вы не в гильдии' });

    const war = isGuildAtWar(member.guildId);
    if (!war || war.status !== 'active') return res.status(400).json({ error: 'Ваша гильдия не в активной войне' });

    const myGuildId = member.guildId;
    const enemyGuildId = war.attackerGuildId === myGuildId ? war.defenderGuildId : war.attackerGuildId;

    // Проверка: цель во вражеской гильдии
    const targetMember = db.prepare('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?').get(enemyGuildId, targetId) as any;
    if (!targetMember) return res.status(400).json({ error: 'Цель не во вражеской гильдии' });

    // Лимит: 3 атаки на атакующего
    const myAttacks = (db.prepare(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?'
    ).get(war.id, userId) as any).cnt;
    if (myAttacks >= 3) return res.status(400).json({ error: 'Вы исчерпали лимит атак (3)' });

    // Лимит: 3 атаки на защитника
    const targetAttacks = (db.prepare(
        'SELECT COUNT(*) as cnt FROM guild_war_attacks WHERE warId = ? AND defenderId = ?'
    ).get(war.id, targetId) as any).cnt;
    if (targetAttacks >= 3) return res.status(400).json({ error: 'Этого игрока уже атаковали максимум раз (3)' });

    // Кулдаун: 5 минут с последней атаки
    const lastAttack = db.prepare(
        'SELECT MAX(createdAt) as lastAt FROM guild_war_attacks WHERE warId = ? AND attackerId = ?'
    ).get(war.id, userId) as any;
    if (lastAttack?.lastAt) {
        const lastTime = new Date(lastAttack.lastAt + 'Z').getTime();
        if (Date.now() - lastTime < 5 * 60 * 1000) {
            return res.status(400).json({ error: 'Атаковать можно раз в 5 минут' });
        }
    }

    // Защита цели: 1 час после атаки
    const lastDefend = db.prepare(
        'SELECT MAX(createdAt) as lastAt FROM guild_war_attacks WHERE warId = ? AND defenderId = ? AND won = 0'
    ).get(war.id, targetId) as any;
    if (lastDefend?.lastAt) {
        const lastTime = new Date(lastDefend.lastAt + 'Z').getTime();
        if (Date.now() - lastTime < 60 * 60 * 1000) {
            return res.status(400).json({ error: 'У игрока защита после атаки (1 час)' });
        }
    }

    // Симуляция боя (макс HP, как в турнире)
    const attacker = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const defender = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;

    const { currentStats } = require('../utils/stats');
    const aStats = currentStats(attacker, JSON.parse(attacker.equipment || '{}'));
    const dStats = currentStats(defender, JSON.parse(defender.equipment || '{}'));

    const aHp = aStats.hp;
    const dHp = dStats.hp;

    // Простой бой
    let aCurrentHp = aHp;
    let dCurrentHp = dHp;
    const log: string[] = [];

    let round = 0;
    while (aCurrentHp > 0 && dCurrentHp > 0 && round < 50) {
        round++;
        // Атакующий бьёт
        const aDmg = Math.max(1, aStats.attack - dStats.defense + Math.floor(Math.random() * 6));
        dCurrentHp -= aDmg;
        log.push(`${attacker.username} наносит ${aDmg} урона (${defender.username}: ${Math.max(0, dCurrentHp)}/${dHp})`);
        if (dCurrentHp <= 0) break;
        // Защитник бьёт
        const dDmg = Math.max(1, dStats.attack - aStats.defense + Math.floor(Math.random() * 6));
        aCurrentHp -= dDmg;
        log.push(`${defender.username} наносит ${dDmg} урона (${attacker.username}: ${Math.max(0, aCurrentHp)}/${aHp})`);
    }

    const won = dCurrentHp <= 0;

    // Запись атаки
    db.prepare(`
        INSERT INTO guild_war_attacks (warId, attackerId, defenderId, attackerGuildId, defenderGuildId, won)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(war.id, userId, targetId, myGuildId, enemyGuildId, won ? 1 : 0);

    // Обновление счёта
    if (won) {
        const scoreField = myGuildId === war.attackerGuildId ? 'attackerScore' : 'defenderScore';
        db.prepare(`UPDATE guild_wars SET ${scoreField} = ${scoreField} + 1 WHERE id = ?`).run(war.id);
    }

    res.json({
        success: true,
        won,
        log,
        attackerHp: aHp,
        defenderHp: dHp,
        finalAttackerHp: Math.max(0, aCurrentHp),
        finalDefenderHp: Math.max(0, dCurrentHp),
    });
});

// Установить ставку налога (только лидер)
router.post('/guild/tax-rate', (req: any, res) => {
    const userId = req.userId;
    const { taxRate } = req.body;
    if (taxRate == null || taxRate < 0 || taxRate > 50) return res.status(400).json({ error: 'Ставка от 0 до 50%' });

    const member = db.prepare('SELECT * FROM guild_members WHERE userId = ?').get(userId) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять налог' });

    db.prepare('UPDATE guilds SET taxRate = ? WHERE id = ?').run(taxRate, member.guildId);
    res.json({ success: true, taxRate });
});

export default router;
