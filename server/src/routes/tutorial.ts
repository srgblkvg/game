import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

// Get tutorial state
router.get('/tutorial/state', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT tutorial_step, tutorial_completed FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ 
        step: user.tutorial_step || 0, 
        completed: user.tutorial_completed || 0 
    });
});

// Step 1: Tutorial PvE fight — first floor, first mob, guaranteed win, guaranteed loot
router.post('/tutorial/pve', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 0) return res.status(400).json({ error: 'Неверный шаг обучения' });

    // First mob: Костяная крыса (id=1, level=1)
    const mob = await db.one('SELECT * FROM mobs WHERE id = 1') as any;
    if (!mob) return res.status(500).json({ error: 'Моб не найден' });

    const username = user.username || 'Игрок';
    const steps: any[] = [];
    const addStep = (step: any) => steps.push(step);

    addStep({ type: 'info', message: `⚔ ${username} vs ${mob.name} (ур. ${mob.level})` });
    addStep({ type: 'info', message: 'Вы атакуете первым!' });
    addStep({ type: 'attack', actor: 'attacker', message: 'Вы атакуете!' });
    addStep({ type: 'damage', damage: 3, target: 'mob', actor: 'attacker', message: 'Урон: 3' });
    addStep({ type: 'info', message: `${mob.name} атакует!` });
    addStep({ type: 'attack', actor: 'defender', message: `${mob.name} атакует!` });
    addStep({ type: 'dodge', actor: 'attacker', message: 'Вы уклоняетесь!' });
    addStep({ type: 'attack', actor: 'attacker', message: 'Вы атакуете!' });
    addStep({ type: 'crit', actor: 'attacker', message: 'Крит!' });
    addStep({ type: 'damage', damage: 5, target: 'mob', actor: 'attacker', message: 'Урон: 5' });
    addStep({ type: 'end', message: `${username} побеждает ${mob.name}!` });

    // Loot: Пыль забвения (craft_item id=1) + Меч (item id=400) + 5 gold
    const inventory = JSON.parse(user.inventory || '[]');

    // Add Пыль забвения
    const existingDust = inventory.find((i: any) => i.type === 'craft_item' && i.id === 1);
    if (existingDust) {
        existingDust.count = (existingDust.count || 0) + 1;
    } else {
        inventory.push({
            type: 'craft_item',
            id: 1,
            name: 'Пыль забвения',
            rarity_id: 0,
            rarity_display: 'Хлам',
            rarity_color: '#888888',
            count: 1,
            itemType: 'craft',
            image: null,
        });
    }

    // Add sword: Стон могильщика (id=400)
    const swordItem = {
        id: Date.now() + Math.random(),
        name: 'Стон могильщика',
        slot: 'weapon1',
        rarity_id: 0,
        rarity_display: 'Хлам',
        rarity_color: '#888888',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
        upgradeLevel: 0,
        image: 'weapon/weapon_gray.webp',
        cost: 10,
    };
    inventory.push(swordItem);
    addStep({ type: 'loot', message: 'Добыто: Пыль забвения + Меч «Стон могильщика»' });

    const newMoney = (user.money || 0) + 5;

    await db.run(
        'UPDATE users SET inventory = ?, money = ?, tutorial_step = 1, lastpveattacktime = ? WHERE id = ?',
        [JSON.stringify(inventory), newMoney, Math.floor(Date.now() / 1000), userId]
    );

    res.json({
        success: true,
        steps,
        loot: {
            dust: 'Пыль забвения',
            sword: 'Стон могильщика',
            gold: 5,
        },
        money: newMoney,
        nextStep: 1,
    });
});

// Step 1→2: Equip sword (client sends equipment state after equipping)
router.post('/tutorial/equip', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 1) return res.status(400).json({ error: 'Неверный шаг обучения' });

    // Check that user has sword equipped
    const equipment = JSON.parse(user.equipment || '{}');
    if (!equipment.weapon1) {
        return res.status(400).json({ error: 'Сначала наденьте меч' });
    }

    await db.run('UPDATE users SET tutorial_step = 2 WHERE id = ?', [userId]);
    res.json({ success: true, nextStep: 2 });
});

// Step 2→3: Tutorial craft — 100% success, creates shield from Пыль забвения
router.post('/tutorial/craft', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 2) return res.status(400).json({ error: 'Неверный шаг обучения' });

    const inventory = JSON.parse(user.inventory || '[]');

    // Find Пыль забвения
    const dustIdx = inventory.findIndex((i: any) => i.type === 'craft_item' && i.id === 1);
    if (dustIdx === -1) {
        return res.status(400).json({ error: 'Нет Пыли забвения в инвентаре' });
    }

    // Consume 1 dust
    if (inventory[dustIdx].count > 1) {
        inventory[dustIdx].count -= 1;
    } else {
        inventory.splice(dustIdx, 1);
    }

    // Create shield: Гробовая преграда (id=421)
    const shieldItem = {
        id: Date.now() + Math.random(),
        name: 'Гробовая преграда',
        slot: 'shield',
        rarity_id: 0,
        rarity_display: 'Хлам',
        rarity_color: '#888888',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 },
        upgradeLevel: 0,
        image: 'shield/shield_gray.webp',
        cost: 10,
    };
    inventory.push(shieldItem);

    await db.run(
        'UPDATE users SET inventory = ?, tutorial_step = 3 WHERE id = ?',
        [JSON.stringify(inventory), userId]
    );

    res.json({
        success: true,
        crafted: {
            name: 'Гробовая преграда',
            slot: 'shield',
            rarity_display: 'Хлам',
        },
        nextStep: 3,
    });
});

// Step 3→4: Equip shield
router.post('/tutorial/equip-shield', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 3) return res.status(400).json({ error: 'Неверный шаг обучения' });

    const equipment = JSON.parse(user.equipment || '{}');
    if (!equipment.shield) {
        return res.status(400).json({ error: 'Сначала наденьте щит' });
    }

    await db.run('UPDATE users SET tutorial_step = 4 WHERE id = ?', [userId]);
    res.json({ success: true, nextStep: 4 });
});

// Step 4→5: Tutorial arena fight
router.post('/tutorial/arena', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 4) return res.status(400).json({ error: 'Неверный шаг обучения' });

    const username = user.username || 'Игрок';
    const steps: any[] = [];
    const addStep = (step: any) => steps.push(step);

    addStep({ type: 'info', message: `⚔ ${username} vs Тренировочный голем` });
    addStep({ type: 'info', message: 'Вы атакуете первым!' });
    addStep({ type: 'attack', actor: 'attacker', message: 'Вы атакуете!' });
    addStep({ type: 'crit', actor: 'attacker', message: 'Крит!' });
    addStep({ type: 'damage', damage: 8, target: 'enemy', actor: 'attacker', message: 'Урон: 8' });
    addStep({ type: 'info', message: 'Тренировочный голем атакует!' });
    addStep({ type: 'attack', actor: 'defender', message: 'Тренировочный голем атакует!' });
    addStep({ type: 'damage', damage: 2, target: 'player', actor: 'defender', message: 'Урон: 2' });
    addStep({ type: 'attack', actor: 'attacker', message: 'Вы атакуете!' });
    addStep({ type: 'damage', damage: 6, target: 'enemy', actor: 'attacker', message: 'Урон: 6' });
    addStep({ type: 'end', message: `${username} побеждает!` });

    await db.run('UPDATE users SET tutorial_step = 5, lastpvptime = ? WHERE id = ?',
        [Math.floor(Date.now() / 1000), userId]);

    res.json({ success: true, steps, nextStep: 5 });
});

// Step 5→complete: Finish tutorial, give 1000 silver
router.post('/tutorial/complete', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 5) return res.status(400).json({ error: 'Неверный шаг обучения' });

    const reward = 1000;
    await db.run(
        'UPDATE users SET tutorial_step = 6, tutorial_completed = 1, money = money + ? WHERE id = ?',
        [reward, userId]
    );

    res.json({ success: true, reward, nextStep: 6, completed: true });
});

export default router;
