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
        'SELECT gm.*, g.name, g.description, g.joinType, g.level, g.exp, g.leaderId, g.treasury, g.createdAt FROM guild_members gm JOIN guilds g ON gm.guildId = g.id WHERE gm.userId = ?'
    ).get(userId) as any;
    if (!member) return res.json({ guild: null });

    const members = db.prepare(
        'SELECT gm.userId, gm.rank, gm.joinedAt, u.username, u.level FROM guild_members gm JOIN users u ON gm.userId = u.id WHERE gm.guildId = ? ORDER BY gm.rank DESC, gm.joinedAt ASC'
    ).all(member.guildId);

    const inviteCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM guild_invites WHERE guildId = ? AND status = 'pending'"
    ).get(member.guildId) as any;

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
            createdAt: member.createdAt,
            myRank: member.rank,
            memberCount: members.length,
            pendingInvites: inviteCount.cnt,
        },
        members,
    });
});

// Список гильдий (должен быть до /guild/:id)
router.get('/guild/list', (req: any, res) => {
    const guilds = db.prepare(`
        SELECT g.*, u.username as leaderName,
            (SELECT COUNT(*) FROM guild_members WHERE guildId = g.id) as memberCount
        FROM guilds g
        JOIN users u ON g.leaderId = u.id
        ORDER BY g.level DESC, g.exp DESC
        LIMIT 50
    `).all();
    res.json(guilds);
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

    res.json({ guild: { ...guild, memberCount }, members });
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
// Получить сообщения гильдии
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

// Отправить сообщение в гильд-чат
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
    // Всем членам (кроме отправителя)
    broadcast('message', { message: msg }, userId);

    res.json({ success: true, message: msg });
});

export default router;
