import { Router } from "express";
import { db } from "../../db/index";
import { isGuildAtWar } from "./guildWar";
import { getGuildBuildings, buildBuilding } from "../../game/guildBuildings";

const router = Router();

// Создать гильдию
router.post('/guild/create', async (req, res) => {
    const userId = req.userId;
    const { name, description, joinType } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите название гильдии' });
    if (!['open', 'request', 'invite'].includes(joinType || 'open')) return res.status(400).json({ error: 'Неверный тип вступления' });

    const user = await db.one('SELECT money, guildId FROM users WHERE id = ?', [userId]) as any;
    if (user.money < 10000) return res.status(400).json({ error: 'Нужно 10000 серебра' });
    if (user.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии. Покиньте текущую чтобы создать новую.' });

    const existing = await db.one('SELECT id FROM guilds WHERE name = ?', [name.trim()]);
    if (existing) return res.status(400).json({ error: 'Гильдия с таким названием уже существует' });

    await db.run('UPDATE users SET money = money - 10000 WHERE id = ?', [userId]);

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
            buildings: await getGuildBuildings(userId),
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
        ORDER BY g.level DESC, g.exp DESC
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

// Переключение разрешений офицера (только лидер)
router.post('/guild/officer-permissions', async (req, res) => {
    const userId = req.userId;
    const { officerId, permission } = req.body; // permission: 'quests' | 'buildings' | 'war'

    if (!officerId || !['quests', 'buildings', 'war'].includes(permission)) {
        return res.status(400).json({ error: 'Укажите officerId и permission (quests/buildings/war)' });
    }

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || member.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять разрешения' });

    const officer = await db.one('SELECT * FROM guild_members WHERE guildId = ? AND userId = ? AND rank = ?',
        [member.guildId, officerId, 'officer']) as any;
    if (!officer) return res.status(400).json({ error: 'Этот игрок не офицер вашей гильдии' });

    const col = `can_${permission}`;
    const current = officer[col] || officer[col.toLowerCase()] || false;
    await db.run(`UPDATE guild_members SET \"${col}\" = ? WHERE guildId = ? AND userId = ?`,
        [!current, member.guildId, officerId]);

    res.json({ success: true, [col]: !current, message: `${permission}: ${!current ? 'включено' : 'выключено'}` });
});

// Заявки на вступление (для лидера/офицеров)
router.get('/guild/:id', async (req, res, next) => {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) return next();
    const guild = await db.one('SELECT g.*, u.username as leaderName FROM guilds g JOIN users u ON g.leaderId = u.id WHERE g.id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });

    const members = await db.query(
        'SELECT gm.userId, gm.rank, gm.joinedAt, gm.can_quests, gm.can_buildings, gm.can_war, u.username, u.level FROM guild_members gm JOIN users u ON gm.userId = u.id WHERE gm.guildId = ? ORDER BY gm.rank DESC, gm.joinedAt ASC',
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


// Построить/улучшить сооружение
router.post('/guild/buildings/build', async (req, res) => {
    try {
        const result = await buildBuilding(req.userId, req.body.buildingType);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
export default router;
