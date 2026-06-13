import { Router } from 'express';
import db from '../database';
import { getBaseStats, enrichEquipment, collectGuildTax, applyExp } from '../db/helpers';
import { currentStats } from '../game/stats';
import { addPveRating } from '../game/rating';
import { getDrinkBonuses } from '../game/drinks';

const router = Router();

// Список всех мобов
router.get('/mobs', async (req, res) => {
    const mobs = await db.manyOrNone('SELECT * FROM mobs ORDER BY level, id') as any[];

    // Собираем изображения и названия материалов по редкостям (первое попавшееся для каждой)
    const craftInfo: Record<number, { image: string; name: string }> = {};
    const allCraft = await db.manyOrNone('SELECT rarity_id, image, name FROM craft_items WHERE image IS NOT NULL') as any[];
    for (const c of allCraft) {
        if (!craftInfo[c.rarity_id] && c.image) {
            craftInfo[c.rarity_id] = { image: c.image, name: c.name };
        }
    }

    // Обогащаем мобов изображениями лута
    const enriched = mobs.map((m: any) => {
        const lootImages: { rarity: number; name: string; image: string; chance: number }[] = [];
        const rarityMap: [number, string, string][] = [
            [0, 'loot_junk', 'Хлам'], [1, 'loot_common', 'Обычный'],
            [2, 'loot_uncommon', 'Необычный'], [3, 'loot_rare', 'Редкий'],
            [4, 'loot_epic', 'Эпический'], [5, 'loot_legendary', 'Легендарный'],
            [6, 'loot_mythic', 'Мифический'],
        ];
        for (const [r, key, rarityName] of rarityMap) {
            const chance = m[key] || 0;
            if (chance > 0 && craftInfo[r]) {
                lootImages.push({ rarity: r, name: craftInfo[r].name, image: craftInfo[r].image, chance });
            }
        }
        return { ...m, lootImages };
    });

    res.json(enriched);
});

// Атака моба
router.post('/mob/attack', async (req, res) => {
    const userId = req.userId;
    const { mobId } = req.body;
    if (!mobId) return res.status(400).json({ error: 'Не указан ID моба' });

    const now = Math.floor(Date.now() / 1000);

    // Проверка кулдауна PvE (раздельный с PvP — 5 мин, премиум 2.5 мин)
    const user = await db.oneOrNone('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hasPremium = (user.premiumUntil || 0) > now;
    const pveCooldown = hasPremium ? 150 : 300;

    if (user.lastPveAttackTime > 0 && (now - user.lastPveAttackTime) < pveCooldown) {
        const remaining = pveCooldown - (now - user.lastPveAttackTime);
        return res.status(400).json({ error: `До следующей атаки моба осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    const mob = await db.oneOrNone('SELECT * FROM mobs WHERE id = ?', [mobId]) as any;
    if (!mob) return res.status(404).json({ error: 'Моб не найден' });

    // Статы игрока
    const userBase = getBaseStats(user);
    const userEquip = JSON.parse(user.equipment || '{}');
    const { enriched: enrichedEquip } = enrichEquipment(db, userEquip);
    const userStats = currentStats(userBase, enrichedEquip, getDrinkBonuses(user),
        (await db.oneOrNone('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]) as any).cnt || 0
    );

    // Статы моба (s=atk, a=agi, d=def, m=mst)
    const mobBase = { s: mob.atk, a: mob.agi, d: mob.def, m: mob.mst };
    const mobStats = currentStats(mobBase, {});

    // Упрощённый бой (подобно PvP, но моб — всегда defender)
    let hpUser = user.currentHp ?? userStats.hp;
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
            addStep({ type: 'damage', damage: dmg, target: 'mob', message: `Урон: ${dmg}` });
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
            addStep({ type: 'damage', damage: dmg, target: 'player', message: `Урон: ${dmg}` });
            hpUser = Math.max(0, hpUser - dmg);
            turn = 'player';
        }
    }

    const playerWon = hpMob <= 0;
    addStep({ type: 'end', message: playerWon ? `${user.username} побеждает ${mob.name}!` : `${mob.name} побеждает!` });

    // XP: +0 если моб слабее, +1 равный, +2 сильнее
    let expGained = 0;
    if (playerWon) {
        if (mob.level > user.level + 2) expGained = 2;
        else if (Math.abs(mob.level - user.level) <= 2) expGained = 1;
    }

    // Золото
    let goldGained = 0;
    let premiumBonus = 0;
    if (playerWon) {
        goldGained = Math.floor(Math.random() * (mob.gold_max - mob.gold_min + 1)) + mob.gold_min;
        if (hasPremium) {
            premiumBonus = Math.max(1, Math.floor(Math.random() * Math.floor(goldGained * 0.3)) + 1);
            goldGained = goldGained + premiumBonus;
        }
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
                await db.none('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory]), userId);

                addStep({ type: 'money', message: `Добыто: ${craftItem.display_name} материал` });
            }
        }
    }

    // Обновление игрока
    const { newExp, newLevel, levelsGained, newStatPoints } = applyExp(db, userId, expGained, user.exp, user.level, user.statPoints || 0);

    // Потеря золота при поражении: 10% от имеющегося
    let goldLost = 0;
    let ratingGained = 0;
    if (!playerWon) {
        goldLost = Math.floor(user.money * 0.1);
        if (goldLost > 0) {
            await db.none('UPDATE users SET money = money - ? WHERE id = ?', [goldLost, userId]);
            addStep({ type: 'money', message: `${mob.name} забирает ${goldLost} монет!` });
        }
    } else {
        // PvE-рейтинг
        const today = new Date().toISOString().slice(0, 10);
        const isBoss = mob.level >= 100;
        const ratingAmount = isBoss ? 10 : mob.level > user.level ? 2 : 1;

        const result = addPveRating(db, userId, ratingAmount, user.pveRating || 0, user.elo || 1000, (u: any) => {
            if (isBoss) return u.lastBossKillDate !== today;
            const now2 = Math.floor(Date.now() / 1000);
            return !u.lastPveRatingTime || (now2 - u.lastPveRatingTime) >= 3600;
        });

        if (result) {
            ratingGained = result.eloAdded;
            const updateFields = ['pveRating = pveRating + ?', 'elo = elo + ?'];
            const updateValues: (number | string)[] = [result.eloAdded, result.eloAdded];
            if (isBoss) {
                updateFields.push('lastBossKillDate = ?');
                updateValues.push(today);
            } else {
                updateFields.push('lastPveRatingTime = ?');
                updateValues.push(now);
            }
            if (ratingGained > 0) {
                addStep({ type: 'rating', message: `Рейтинг +${ratingGained}` });
            }
            await db.none(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, userId]);
        }
    }

    const newHpAfter = Math.max(0, hpUser);

    // Налог гильдии (PvE)
    const goldAfterTax = collectGuildTax(db, userId, goldGained, 'tax_pve');

    await db.none(`UPDATE users SET level=?, exp=?, money=money+?, currentHp=?, lastPveAttackTime=?, lastHpUpdate=?, statPoints=?, pveTotalBattles=pveTotalBattles+1, pveWins=pveWins+?, totalPveMoneyWon=totalPveMoneyWon+?, totalPveMoneyLost=totalPveMoneyLost+? WHERE id=?`, [newLevel, newExp, goldAfterTax, newHpAfter, now, now, newStatPoints, playerWon ? 1 : 0, playerWon ? goldGained : 0, playerWon ? 0 : goldLost, userId]);

    // Сохраняем в историю PvE
    await db.none(`INSERT INTO pve_battles (userId, mobId, mobName, mobLevel, playerWon, steps, expGained, goldGained, goldLost, materialDropped, premiumBonus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, mobId, mob.name, mob.level, playerWon ? 1 : 0, JSON.stringify(steps]), playerWon ? expGained : 0, goldGained, goldLost, materialDropped ? JSON.stringify(materialDropped) : null, premiumBonus);

    res.json({
        log,
        steps,
        playerWon,
        expGained: playerWon ? expGained : 0,
        goldGained,
        premiumBonus,
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
