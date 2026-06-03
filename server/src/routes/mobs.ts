import { Router } from 'express';
import db from '../database';
import { getBaseStats, enrichEquipment } from '../db/helpers';
import { currentStats } from '../game/stats';

const router = Router();

// Список всех мобов
router.get('/mobs', (req: any, res) => {
    const mobs = db.prepare('SELECT * FROM mobs ORDER BY level, id').all();
    res.json(mobs);
});

// Атака моба
router.post('/mob/attack', (req: any, res) => {
    const userId = req.userId;
    const { mobId } = req.body;
    if (!mobId) return res.status(400).json({ error: 'Не указан ID моба' });

    const now = Math.floor(Date.now() / 1000);

    // Проверка кулдауна PvE (раздельный с PvP — 5 минут)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.lastPveAttackTime > 0 && (now - user.lastPveAttackTime) < 300) {
        const remaining = 300 - (now - user.lastPveAttackTime);
        return res.status(400).json({ error: `До следующей атаки моба осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    const mob = db.prepare('SELECT * FROM mobs WHERE id = ?').get(mobId) as any;
    if (!mob) return res.status(404).json({ error: 'Моб не найден' });

    // Статы игрока
    const userBase = getBaseStats(user);
    const userEquip = JSON.parse(user.equipment || '{}');
    const { enriched: enrichedEquip } = enrichEquipment(db, userEquip);
    const userStats = currentStats(userBase, enrichedEquip);

    // Статы моба (s=atk, a=agi, d=def, m=mst)
    const mobBase = { s: mob.atk, a: mob.agi, d: mob.def, m: mob.mst };
    const mobStats = currentStats(mobBase, {});

    // Упрощённый бой (подобно PvP, но моб — всегда defender)
    let hpUser = userStats.hp;
    let hpMob = mob.hp;
    const log: string[] = [];
    const steps: any[] = [];

    const addStep = (step: any) => { steps.push(step); log.push(step.message); };

    addStep({ type: 'info', message: `⚔ ${user.username} vs ${mob.name} (ур. ${mob.level})` });

    const dodgeChance = (agility: number) => Math.max(0, agility / (agility + 50));
    const critChance = (mst: number) => Math.min(0.8, mst / (mst + 50));
    const critMult = (mst: number) => 1.5 + 0.5 * (mst / (mst + 50));

    let turn: 'player' | 'mob' = userStats.a >= mob.agi ? 'player' : 'mob';
    addStep({ type: 'info', message: turn === 'player' ? 'Вы ходите первым' : `${mob.name} атакует первым` });

    let turns = 0;
    const maxTurns = 100;

    while (hpUser > 0 && hpMob > 0 && turns < maxTurns) {
        turns++;
        if (turn === 'player') {
            addStep({ type: 'attack', message: 'Вы атакуете!' });

            if (Math.random() < dodgeChance(mob.agi)) {
                addStep({ type: 'dodge', message: `${mob.name} уклоняется!` });
                turn = 'mob';
                continue;
            }

            let dmg = userStats.s > user.level
                ? Math.floor(user.level + Math.random() * (userStats.s - user.level + 1))
                : userStats.s;

            if (Math.random() < critChance(userStats.m)) {
                dmg = Math.round(dmg * critMult(userStats.m));
                addStep({ type: 'crit', message: 'Крит!' });
            }

            dmg = Math.max(0, Math.round(dmg));
            addStep({ type: 'damage', damage: dmg, message: `Урон: ${dmg}` });
            hpMob = Math.max(0, hpMob - dmg);
            turn = 'mob';
        } else {
            addStep({ type: 'attack', message: `${mob.name} атакует!` });

            if (Math.random() < dodgeChance(userStats.a)) {
                addStep({ type: 'dodge', message: 'Вы уклоняетесь!' });
                turn = 'player';
                continue;
            }

            let dmg = mobStats.s > mob.level
                ? Math.floor(mob.level + Math.random() * (mobStats.s - mob.level + 1))
                : mobStats.s;

            if (Math.random() < critChance(mobStats.m)) {
                dmg = Math.round(dmg * critMult(mobStats.m));
                addStep({ type: 'crit', message: 'Крит!' });
            }

            dmg = Math.max(0, Math.round(dmg));
            addStep({ type: 'damage', damage: dmg, message: `Урон: ${dmg}` });
            hpUser = Math.max(0, hpUser - dmg);
            turn = 'player';
        }
    }

    const playerWon = hpMob <= 0;
    addStep({ type: 'end', message: playerWon ? `${user.username} побеждает ${mob.name}!` : `${mob.name} побеждает!` });

    // XP: +0 если моб слабее, +1 равный, +2 сильнее
    let xpGained = 0;
    if (playerWon) {
        if (mob.level > user.level + 2) xpGained = 2;
        else if (Math.abs(mob.level - user.level) <= 2) xpGained = 1;
    }

    // Золото
    let goldGained = 0;
    if (playerWon) {
        goldGained = Math.floor(Math.random() * (mob.gold_max - mob.gold_min + 1)) + mob.gold_min;
    }

    // Шанс дропа материала (~35%)
    let materialDropped: any = null;
    if (playerWon) {
        const dropRoll: number = Math.random();
        if (dropRoll < 0.35) {
            // Определяем редкость по таблице дропа
            const lootTable: Array<{ rarity: number; chance: number }> = [
                { rarity: 0, chance: mob.loot_junk },
                { rarity: 1, chance: mob.loot_common },
                { rarity: 2, chance: mob.loot_uncommon },
                { rarity: 3, chance: mob.loot_rare },
                { rarity: 4, chance: mob.loot_epic },
                { rarity: 5, chance: mob.loot_legendary },
                { rarity: 6, chance: mob.loot_mythic },
            ];

            let rarityRoll = Math.random();
            let selectedRarity = 0;
            for (const lt of lootTable) {
                if (rarityRoll < lt.chance) { selectedRarity = lt.rarity; break; }
                rarityRoll -= lt.chance;
            }

            const craftItem = db.prepare(
                'SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ?'
            ).get(selectedRarity) as any;

            if (craftItem) {
                materialDropped = {
                    type: 'craft_item',
                    id: craftItem.id,
                    name: craftItem.name,
                    rarity_id: craftItem.rarity_id,
                    rarity_display: craftItem.display_name,
                    rarity_color: craftItem.color,
                    count: 1,
                    itemType: craftItem.type || 'craft',
                    image: craftItem.image || null,
                };

                // Добавляем в инвентарь
                const inventory = JSON.parse(user.inventory || '[]');
                const existing = inventory.find((i: any) => i.type === 'craft_item' && i.id === craftItem.id);
                if (existing) {
                    existing.count = (existing.count || 0) + 1;
                } else {
                    inventory.push(materialDropped);
                }
                db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);

                addStep({ type: 'money', message: `Добыто: ${craftItem.display_name} материал` });
            }
        }
    }

    // Обновление игрока
    let newExp = user.exp + xpGained;
    let newLevel = user.level;
    let levelsGained = 0;
    while (true) {
        const required = 10 * Math.pow(2, newLevel - 1);
        if (newExp >= required) { newExp -= required; newLevel++; levelsGained++; }
        else break;
    }

    // Потеря золота при поражении: 10% от имеющегося
    let goldLost = 0;
    if (!playerWon) {
        goldLost = Math.floor(user.money * 0.1);
        if (goldLost > 0) {
            db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(goldLost, userId);
            addStep({ type: 'money', message: `${mob.name} забирает ${goldLost} монет!` });
        }
    }

    const newStatPoints = (user.statPoints || 0) + levelsGained * 5;
    const newHpAfter = Math.max(0, hpUser);

    db.prepare(`UPDATE users SET level=?, exp=?, money=money+?, currentHp=?, lastPveAttackTime=?, lastHpUpdate=?, statPoints=? WHERE id=?`)
        .run(newLevel, newExp, goldGained, newHpAfter, now, now, newStatPoints, userId);

    res.json({
        log,
        steps,
        playerWon,
        xpGained: playerWon ? xpGained : 0,
        goldGained,
        goldLost,
        newLevel,
        newExp,
        levelsGained,
        materialDropped,
        hpAfter: newHpAfter,
        mob: { id: mob.id, name: mob.name, level: mob.level, hp: mob.hp },
    });
});

export default router;
