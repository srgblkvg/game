import { Router } from 'express';
import { db } from '../db/index';
import { collectGuildTax, applyExp, buildPlayerStats } from '../db/helpers';
import { currentStats } from '../game/stats';
import { applyHpRegen } from '../game/hpRegen';
import { runTurn, dodgeChance, critChance, critMult, blockChance, blockReduction, TurnContext, BattleStep } from '../game/battle';
import { markDirty, pushNotification } from '../events';
import { checkAchievement, trackIncome } from './achievements';
import { sendLeaderboardLevel } from '../vkLeaderboard';
import { updateGuildQuestProgress } from './guild';

const router = Router();
const HUNT_DROP_MULTIPLIER = 1 / 3;
const MATERIAL_DROP_CHANCE = 0.35 * HUNT_DROP_MULTIPLIER;
const STONE_DROP_CHANCE = 0.05 * HUNT_DROP_MULTIPLIER;
const MYTHIC_RESOURCE_DROP_CHANCE = 0.01 * HUNT_DROP_MULTIPLIER;

// Шансы дропа камней улучшения (независимые роллы на каждого моба)
const STONE_DROP_CHANCES: Record<string, number> = {
    'Рунный булыжник': 0.03,
    'Рунный белокамень': 0.02,
    'Руна Изумруда': 0.015,
    'Руна Сапфира': 0.01,
    'Руна Аметиста': 0.005,
    'Руна Топаза': 0.0025,
    'Руна Рубина': 0.001,
};

// Редкие мифические ресурсы — 5% с конкретных монстров (начиная со Смерти)
const MYTHIC_RESOURCE_DROPS: Record<number, string> = {
    30: 'Кровь демона',       // Смерть (100)
    47: 'Эссенция гнева',     // Бес-кровопускатель (110)
    48: 'Пыльца фей',         // Одержимый рыцарь (115)
    49: 'Кристалл душ',       // Инкуб-искуситель (118)
    50: 'Чешуя василиска',    // Архидемон (122)
    51: 'Кровь демона',       // Василиск адский (125)
    52: 'Эссенция гнева',     // Лорд пламени (130)
    53: 'Пыльца фей',         // Костяной дракон (135)
    54: 'Кристалл душ',       // Падший серафим (140)
    55: 'Кристалл душ',       // Рыцарь крови (145)
    56: 'Кристалл душ',       // Палач предела (155)
    57: 'Кристалл душ',       // Кровавый лорд (165)
    58: 'Кристалл душ',       // Проклятый страж (180)
    59: 'Кристалл душ',       // Архилич проклятых (195)
    60: 'Кристалл душ',       // Король проклятых (210)
};

// Шансы дропа предметов по редкостям в зависимости от уровня моба
function getItemDropTable(level: number): { rarity: number; chance: number }[] {
    const table: { rarity: number; chance: number }[] = [];
    
    if (level <= 10) {
        table.push({ rarity: 0, chance: 0.07 }); // Хлам 7%
        table.push({ rarity: 1, chance: 0.02 }); // Обычный 2%
    } else if (level <= 25) {
        table.push({ rarity: 0, chance: 0.07 });
        table.push({ rarity: 1, chance: 0.05 }); // Обычный 5%
        table.push({ rarity: 2, chance: 0.02 }); // Необычный 2%
    } else if (level <= 45) {
        table.push({ rarity: 0, chance: 0.07 });
        table.push({ rarity: 1, chance: 0.07 });
        table.push({ rarity: 2, chance: 0.05 });
        table.push({ rarity: 3, chance: 0.03 }); // Редкий 3%
    } else if (level <= 65) {
        table.push({ rarity: 0, chance: 0.07 });
        table.push({ rarity: 1, chance: 0.07 });
        table.push({ rarity: 2, chance: 0.07 });
        table.push({ rarity: 3, chance: 0.05 });
        table.push({ rarity: 4, chance: 0.03 }); // Эпический 3%
    } else if (level <= 85) {
        table.push({ rarity: 0, chance: 0.07 });
        table.push({ rarity: 1, chance: 0.07 });
        table.push({ rarity: 2, chance: 0.07 });
        table.push({ rarity: 3, chance: 0.07 });
        table.push({ rarity: 4, chance: 0.05 });
        table.push({ rarity: 5, chance: 0.03 }); // Легендарный 3%
    } else if (level <= 100) {
        table.push({ rarity: 0, chance: 0.07 });
        table.push({ rarity: 1, chance: 0.07 });
        table.push({ rarity: 2, chance: 0.07 });
        table.push({ rarity: 3, chance: 0.07 });
        table.push({ rarity: 4, chance: 0.05 });
        table.push({ rarity: 5, chance: 0.05 });
        table.push({ rarity: 6, chance: 0.03 }); // Мифический (не-сет) 3%
    } else if (level <= 140) {
        // Уровни 101-140 (Ад I/II/III): мусор не падает, высокий шанс сетов/мификов
        table.push({ rarity: 3, chance: 0.05 }); // Редкий 5%
        table.push({ rarity: 4, chance: 0.08 }); // Эпический 8%
        table.push({ rarity: 5, chance: 0.15 }); // Легендарный 15%
        table.push({ rarity: 6, chance: 0.08 }); // Мифический 8%
    } else {
        // Уровни 141+ (Ад IV): только сеты и мифики
        table.push({ rarity: 4, chance: 0.05 }); // Эпический 5%
        table.push({ rarity: 5, chance: 0.20 }); // Легендарный 20%
        table.push({ rarity: 6, chance: 0.15 }); // Мифический 15%
    }
    return table.map(entry => ({ ...entry, chance: entry.chance * HUNT_DROP_MULTIPLIER }));
}

// Получить список мобов
router.get('/mobs', async (req, res) => {
    const mobs = await db.query('SELECT * FROM mobs ORDER BY level, id', []) as any[];

    // Собираем изображения и названия материалов по редкостям (первое попавшееся для каждой)
    const craftInfo: Record<number, { image: string; name: string }> = {};
    const allCraft = await db.query("SELECT rarity_id, image, name FROM craft_items WHERE type = 'craft' AND image IS NOT NULL", []) as any[];
    for (const c of allCraft) {
        if (!craftInfo[c.rarity_id] && c.image) {
            craftInfo[c.rarity_id] = { image: c.image, name: c.name };
        }
    }

    // Обогащаем мобов изображениями лута

    // Все камни улучшения (для лут-превью)
    const allStones = await db.query(
        "SELECT name, image FROM craft_items WHERE type = 'upgrade' ORDER BY rarity_id", []
    ) as any[];

    const specialMaterials = await db.query(
        "SELECT name, image FROM craft_items WHERE type IN ('material', 'soul_crystal')", []
    ) as any[];
    const specialMaterialMap = new Map(specialMaterials.map((item: any) => [item.name, item]));

    const equipmentInfo = await db.query(`
        SELECT i.rarity_id,
               (ARRAY_AGG(i.image ORDER BY (i.extra::text LIKE '%"set"%'), i.name)
                   FILTER (WHERE i.image IS NOT NULL))[1] AS image,
               (ARRAY_AGG(i.name ORDER BY (i.extra::text LIKE '%"set"%'), i.name))[1] AS name,
               r.color AS rarity_color,
               COUNT(*) AS total_count,
               COUNT(*) FILTER (WHERE i.extra::text LIKE '%"set"%') AS set_count
        FROM items i JOIN rarities r ON r.id = i.rarity_id
        GROUP BY i.rarity_id, r.color ORDER BY i.rarity_id
    `, []) as any[];
    const equipmentMap = new Map(equipmentInfo.map((item: any) => [Number(item.rarity_id), item]));

    const enriched = mobs.map((m) => {
        const lootImages: { rarity: number; name: string; image: string; chance: number }[] = [];
        const rarityMap: [number, string, string][] = [
            [0, 'loot_junk', 'Хлам'], [1, 'loot_common', 'Обычный'],
            [2, 'loot_uncommon', 'Необычный'], [3, 'loot_rare', 'Редкий'],
            [4, 'loot_epic', 'Эпический'], [5, 'loot_legendary', 'Легендарный'],
            [6, 'loot_mythic', 'Мифический'],
        ];
        for (const [r, key, rarityName] of rarityMap) {
            const chance = (m[key] || 0) * MATERIAL_DROP_CHANCE;
            if (chance > 0 && craftInfo[r]) {
                lootImages.push({ rarity: r, name: craftInfo[r].name, image: craftInfo[r].image, chance });
            }
        }
        // Все камни улучшения (веса → реальные шансы общего ролла)
        const totalStoneWeight = Object.values(STONE_DROP_CHANCES).reduce((s, w) => s + w, 0);
        for (const stone of allStones) {
            const weight = STONE_DROP_CHANCES[stone.name] || 0;
            if (weight > 0) {
                const realChance = (weight / totalStoneWeight) * STONE_DROP_CHANCE;
                lootImages.push({ rarity: -1, name: stone.name, image: stone.image, chance: realChance });
            }
        }
        const itemTable = getItemDropTable(m.level);
        const equipmentDrops = itemTable.map(entry => {
            const info = equipmentMap.get(entry.rarity);
            const totalCount = Number(info?.totalCount ?? info?.total_count ?? 0);
            const setCount = m.level >= 100 ? Number(info?.setCount ?? info?.set_count ?? 0) : 0;
            return {
                ...entry,
                image: info?.image || null,
                name: info?.name || null,
                rarityColor: info?.rarityColor || info?.rarity_color || null,
                setChance: totalCount > 0 ? entry.chance * setCount / totalCount : 0,
            };
        });
        const mythicName = MYTHIC_RESOURCE_DROPS[m.id];
        const specialMaterial = mythicName ? specialMaterialMap.get(mythicName) : null;
        const artifactMaterialDrop = specialMaterial ? {
            name: mythicName,
            image: specialMaterial.image || null,
            chance: MYTHIC_RESOURCE_DROP_CHANCE,
        } : null;
        return { ...m, hp: (m.hp || 50) * 2, lootImages, itemDropTable: itemTable,
            equipmentDrops, artifactMaterialDrop };
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
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hasPremium = (user.premiumUntil || 0) > now;
    const pveCooldown = hasPremium ? 150 : 300; // премиум: 2.5 мин, базовый: 5 мин

    if (user.lastPveAttackTime > 0 && (now - user.lastPveAttackTime) < pveCooldown) {
        const remaining = pveCooldown - (now - user.lastPveAttackTime);
        return res.status(400).json({ error: `До следующей атаки осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    const mob = await db.one('SELECT * FROM mobs WHERE id = ?', [mobId]) as any;
    if (!mob) return res.status(404).json({ error: 'Моб не найден' });

    // Бой
    const userStats = await buildPlayerStats(user, 'pve');
    // Бонус фракции Стражник: +10% против монстров
    if (user.faction === 'guard') {
        const mult = 1.10;
        userStats.s = Math.round(userStats.s * mult);
        userStats.a = Math.round(userStats.a * mult);
        userStats.d = Math.round(userStats.d * mult);
        userStats.m = Math.round(userStats.m * mult);
        userStats.hp = Math.round(userStats.hp * mult);
    }
    const mobBase = { s: mob.atk || 10, a: mob.agi || 5, d: mob.def || 5, m: mob.mst || 5 };
    const mobStats = currentStats(mobBase, {});
    // Применяем эффекты моба из JSON
    if (mob.effects) {
        try {
            const fx = typeof mob.effects === 'string' ? JSON.parse(mob.effects) : mob.effects;
            Object.assign(mobStats, fx);
        } catch {}
    }
    const mobHp = (mob.hp || 50) * 2;
    // Применяем регенерацию HP перед боем
    const regeneratedHp = await applyHpRegen({
        id: user.id, currentHp: user.currentHp, maxHp: userStats.hp,
        lastHpUpdate: user.lastHpUpdate || now, roomType: user.roomType, roomUntil: user.roomUntil,
        premiumUntil: user.premiumUntil,
    });
    if (regeneratedHp < userStats.hp * 0.2) {
        return res.status(400).json({ error: 'Для участия в охоте необходимо не менее 20% здоровья' });
    }
    let userHp = regeneratedHp;
    let mobCurrentHp = mobHp;

    const steps: any[] = [];
    const addStep = (s: any) => steps.push(s);

    addStep({
        type: 'attack', actor: 'attacker', message: `⚔ ${user.username} vs ${mob.name}`,
        hp1: userHp, hp2: mobCurrentHp, maxHp1: userHp, maxHp2: mobHp,
        stats1: { name: user.username, level: user.level, S: userStats.s, A: userStats.a, D: userStats.d, M: userStats.m, HP: userHp },
        stats2: { name: mob.name, level: mob.level, S: mobBase.s, A: mobBase.a, D: mobBase.d, M: mobBase.m, HP: mobHp },
    });

    let playerWon = false;
    let stunnedUser = false;
    let stunnedMob = false;

    // Симуляция боя (как в PvP, но без воровства денег)
    for (let turn = 0; turn < 50 && userHp > 0 && mobCurrentHp > 0; turn++) {
        // Ход игрока
        if (stunnedUser) {
            addStep({ type: 'stun', actor: 'attacker', message: `${user.username} оглушён и пропускает ход` });
            stunnedUser = false;
        } else {
            const ctx1: TurnContext = {
                actorName: user.username, targetName: mob.name,
                actorStats: userStats, targetStats: mobStats,
                actorLevel: user.level,
                hpActor: userHp, hpTarget: mobCurrentHp,
                maxHpActor: userStats.hp, maxHpTarget: mobHp,
                actor: 'attacker', target: 'defender',
            };
            const result1 = runTurn(ctx1, addStep);
            userHp = result1.hpActor;
            mobCurrentHp = result1.hpTarget;
            stunnedMob = result1.stunnedTarget;
        }
        if (mobCurrentHp <= 0) { playerWon = true; break; }

        // Ход моба
        if (stunnedMob) {
            addStep({ type: 'stun', actor: 'defender', message: `${mob.name} оглушён и пропускает ход` });
            stunnedMob = false;
        } else {
            const ctx2: TurnContext = {
                actorName: mob.name, targetName: user.username,
                actorStats: mobStats, targetStats: userStats,
                actorLevel: mob.level,
                hpActor: mobCurrentHp, hpTarget: userHp,
                maxHpActor: mobHp, maxHpTarget: userStats.hp,
                actor: 'defender', target: 'attacker',
            };
            const result2 = runTurn(ctx2, addStep);
            mobCurrentHp = result2.hpActor;
            userHp = result2.hpTarget;
            stunnedUser = result2.stunnedTarget;
        }
        if (userHp <= 0) break;
        if (mobCurrentHp <= 0) { playerWon = true; break; }
    }

    if (playerWon) {
        addStep({ type: 'end', message: `${user.username} победил!` });
    } else {
        addStep({ type: 'end', message: `${mob.name} победил!` });
    }

    // Опыт
    let expGained = 0;
    if (playerWon) {
        const levelDiff = mob.level - user.level;
        if (levelDiff >= -2) expGained = mob.xp || 1;
        else if (levelDiff >= -5) expGained = 1;
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

    // Шанс дропа материала (обучение сохраняет гарантированный ролл)
    const materialsDropped: any[] = [];
    let itemsDropped: any[] = [];
    if (playerWon) {
        const isTutorial = (user.tutorial_step || 0) === 0;
        const dropRoll: number = Math.random();
        // Туториал: гарантированный дроп материала для крафта
        if (isTutorial || dropRoll < MATERIAL_DROP_CHANCE) {
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
            let selectedRarity = -1;
            for (const lt of lootTable) {
                if (rarityRoll < lt.chance) { selectedRarity = lt.rarity; break; }
                rarityRoll -= lt.chance;
            }

            if (selectedRarity >= 0) {
            // Туториал: даём материал для крафта (исключаем камни улучшения)
            const matQuery = isTutorial
                ? 'SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ? AND c.type != \'upgrade\' ORDER BY RANDOM() LIMIT 1'
                : mob.level >= 100
                ? 'SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ? ORDER BY RANDOM() LIMIT 1'
                : "SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ? AND c.type != 'material' ORDER BY RANDOM() LIMIT 1";
            const craftItem = await db.one(matQuery, [selectedRarity]) as any;

            if (craftItem) {
                const matDrop = {
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
                materialsDropped.push(matDrop);

                // Добавляем в инвентарь
                const inventory = JSON.parse(user.inventory || '[]');
                const existing = inventory.find((i: any) => i.type === 'craft_item' && i.id === craftItem.id);
                if (existing) {
                    existing.count = (existing.count || 0) + 1;
                } else {
                    inventory.push(matDrop);
                }
                await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
                user.inventory = JSON.stringify(inventory);

                addStep({ type: 'money', message: `Добыто: ${craftItem.display_name} материал` });
            }
            } // if (selectedRarity >= 0)
        }

        // Камни улучшения — один общий ролл, выбор по весам
        if (Math.random() < STONE_DROP_CHANCE) {
            // Веса для выбора типа камня
            const stoneWeights: [string, number][] = Object.entries(STONE_DROP_CHANCES);
            const totalWeight = stoneWeights.reduce((s, [, w]) => s + w, 0);
            let roll = Math.random() * totalWeight;
            let pickedName = (stoneWeights[0]?.[0]) || '';
            for (const [name, weight] of stoneWeights) {
                roll -= weight;
                if (roll <= 0) { pickedName = name; break; }
            }
            const stone = await db.one(
                "SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?",
                [pickedName]
            ) as any;
            if (stone) {
                const inventory = JSON.parse(user.inventory || '[]');
                const stoneDrop = {
                    type: 'craft_item',
                    id: stone.id,
                    name: stone.name,
                    rarity_id: stone.rarity_id,
                    rarity_display: stone.display_name,
                    rarity_color: stone.color,
                    count: 1,
                    itemType: stone.type || 'upgrade',
                    image: stone.image || null,
                };
                materialsDropped.push(stoneDrop);
                const existing = inventory.find((i: any) => i.type === 'craft_item' && i.id === stone.id);
                if (existing) {
                    existing.count = (existing.count || 0) + 1;
                } else {
                    inventory.push(stoneDrop);
                }
                await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
                user.inventory = JSON.stringify(inventory);
                addStep({ type: 'money', message: `Добыто: ${stone.name}` });
            }
        }

        // Мифический ресурс с конкретных монстров
        const mythicName = MYTHIC_RESOURCE_DROPS[mob.id];
        if (mythicName && Math.random() < MYTHIC_RESOURCE_DROP_CHANCE) {
            const mythicItem = await db.one(
                "SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?",
                [mythicName]
            ) as any;
            if (mythicItem) {
                const inventory = JSON.parse(user.inventory || '[]');
                const mythicDrop = {
                    type: 'craft_item',
                    id: mythicItem.id,
                    name: mythicItem.name,
                    rarity_id: mythicItem.rarity_id,
                    rarity_display: mythicItem.display_name,
                    rarity_color: mythicItem.color,
                    count: 1,
                    itemType: mythicItem.type || 'craft',
                    image: mythicItem.image || null,
                };
                materialsDropped.push(mythicDrop);
                const existing = inventory.find((i: any) => i.type === 'craft_item' && i.id === mythicItem.id);
                if (existing) {
                    existing.count = (existing.count || 0) + 1;
                } else {
                    inventory.push(mythicDrop);
                }
                await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
                user.inventory = JSON.stringify(inventory);
                addStep({ type: 'money', message: `Добыто: ${mythicItem.name}` });
            }
        }

        // Случайный предмет — каждый уровень редкости проверяется отдельно
        const itemTable = getItemDropTable(mob.level);
        const canDropSets = mob.level >= 100;
        for (const entry of itemTable) {
            if (Math.random() < entry.chance) {
                let itemQuery = 'SELECT i.*, r.display_name, r.color FROM items i JOIN rarities r ON i.rarity_id = r.id WHERE i.rarity_id = ?';
                if (!canDropSets) {
                    itemQuery += " AND (i.extra IS NULL OR i.extra::text NOT LIKE '%\"set\"%')";
                }
                itemQuery += ' ORDER BY RANDOM() LIMIT 1';
                const randomItem = await db.one(itemQuery, [entry.rarity]) as any;
                if (randomItem) {
                    const inv = JSON.parse(user.inventory || '[]');
                    const drop = {
                        id: Date.now() + Math.random(),
                        name: randomItem.name,
                        slot: randomItem.slot,
                        rarity_id: randomItem.rarity_id,
                        rarity_display: randomItem.display_name,
                        rarity_color: randomItem.color,
                        bonuses: JSON.parse(randomItem.bonuses || '{}'),
                        extra: JSON.parse(randomItem.extra || '{}'),
                        image: randomItem.image || null,
                    };
                    inv.push(drop);
                    await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inv), userId]);
                    itemsDropped.push(drop);
                    user.inventory = JSON.stringify(inv);
                    addStep({ type: 'money', message: `Добыто: ${randomItem.display_name} предмет — ${randomItem.name}` });
                }
            }
        }
    }

    // Обновление игрока
    const { newExp, newLevel, levelsGained, newStatPoints } = await applyExp(userId, expGained, user.exp, user.level, user.statPoints || 0);

    // Потеря золота при поражении: 10% от имеющегося
    let goldLost = 0;
    if (!playerWon) {
        goldLost = Math.max(1, Math.floor(user.money * 0.05));
    }

    const finalMoney = user.money + goldGained - goldLost;
    const finalHp = Math.max(1, userHp);

    // Налог гильдии
    const goldAfterTax = playerWon ? await collectGuildTax(userId, goldGained, 'tax_pve') : goldGained;
    const finalMoneyAfterTax = user.money + goldAfterTax - goldLost;

    await db.run('UPDATE users SET level=?, exp=?, money=?, currentHp=?, lastPveAttackTime=?, lastHpUpdate=?, statPoints=statPoints+?, pveTotalBattles=pveTotalBattles+1, pveWins=pveWins+?, totalPveMoneyWon=totalPveMoneyWon+?, totalPveMoneyLost=totalPveMoneyLost+? WHERE id=?',
        [newLevel, newExp, finalMoneyAfterTax, finalHp, now, now, levelsGained * 5, playerWon ? 1 : 0, goldGained, goldLost, userId]);

    // Достижения
    if (playerWon) {
        checkAchievement(userId, 'pve_wins').catch(() => {});
        if (goldAfterTax > 0) trackIncome(userId, goldAfterTax).catch(() => {});
        // Туториал: первый PvE-бой → шаг 1 (Магазин)
        if ((user.tutorial_step || 0) === 0) {
            await db.run('UPDATE users SET tutorial_step = 1 WHERE id = ?', [userId]);
        }
    }
    // Карма Стражника: +1 за победу над мобом
    if (playerWon && user.faction === 'guard') {
        await db.run('UPDATE users SET karma = GREATEST(-100, LEAST(100, karma + 1)) WHERE id = ?', [userId]);
    }

    // VK Leaderboard
    if (levelsGained > 0 && user.oauthProvider === 'vk' && user.oauthId) {
        sendLeaderboardLevel(userId, newLevel, String(user.oauthId)).catch(() => {});
    }

    // Обновление прогресса гильдейского квеста (PvE)
    if (playerWon) {
        const userGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
        if (userGuild?.guildId) {
            updateGuildQuestProgress(userGuild.guildId, 'pve').catch(e => console.error('guildQuest PvE:', e.message));
        }
    }

    // Обновление ежедневных квестов (PvE)
    if (playerWon) {
        markDirty(userId, 'quests');
    }

    // Сохраняем в историю PvE
    await db.run(`INSERT INTO pve_battles (userId, mobId, mobName, mobLevel, playerWon, steps, expGained, goldGained, goldLost, materialDropped, itemsDropped, premiumBonus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, mobId, mob.name, mob.level, playerWon ? 1 : 0, JSON.stringify(steps), playerWon ? expGained : 0, goldGained, goldLost, materialsDropped.length > 0 ? JSON.stringify(materialsDropped) : null, itemsDropped.length > 0 ? JSON.stringify(itemsDropped) : null, premiumBonus]);

    const updatedUser = await db.one('SELECT level, exp, money, statPoints, pveWins, pveTotalBattles FROM users WHERE id = ?', [userId]) as any;

    res.json({
        log: steps.map((s: any) => s.message),
        steps,
        expGained: playerWon ? expGained : 0,
        goldGained,
        goldLost,
        newLevel,
        newExp,
        levelsGained,
        playerWon,
        mob: { name: mob.name, level: mob.level, hp: mobHp },
        currentHp: finalHp,
        hpAfter: finalHp,
        mobHpAfter: mobCurrentHp,
        stats: await buildPlayerStats(updatedUser, 'pve'),
        materialDropped: materialsDropped,
        itemsDropped,
        premiumBonus,
    });
});

export default router;
