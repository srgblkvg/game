import { Router } from 'express';
import { db } from '../db/index';
import { grantTutorialPveReward, grantTutorialCraftReward, completeTutorial } from '../game/tutorialRewards';
import { createPgTutorialRewardRepository } from '../game/tutorialRewardsRepository';
import { advanceTutorialArenaStep, advanceTutorialEquipmentStep } from '../game/tutorialProgress';
import { createPgTutorialProgressRepository } from '../game/tutorialProgressRepository';

const router = Router();

function tutorialRewardError(res: any, error: any): boolean {
    const message = error?.message || '';
    const expected = ['Неверный шаг обучения', 'Нет Пыли забвения в инвентаре'];
    if (expected.includes(message)) {
        res.status(400).json({ error: message });
        return true;
    }
    return false;
}

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

    const dust = {
        type: 'craft_item', id: 1, name: 'Пыль забвения', rarity_id: 0,
        rarity_display: 'Хлам', rarity_color: '#888888', count: 1,
        itemType: 'craft', image: null,
    };
    const swordItem = {
        id: Date.now() + Math.random(), name: 'Стон могильщика', slot: 'weapon1',
        rarity_id: 0, rarity_display: 'Хлам', rarity_color: '#888888',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
        upgradeLevel: 0, image: 'weapon/weapon_gray.webp', cost: 10,
    };
    let reward;
    try {
        reward = await grantTutorialPveReward(createPgTutorialRewardRepository(), {
            userId, sword: swordItem, dust, now: Math.floor(Date.now() / 1000),
        });
    } catch (error) {
        if (tutorialRewardError(res, error)) return;
        throw error;
    }
    const newMoney = reward.money;
    addStep({ type: 'loot', message: 'Добыто: Пыль забвения + Меч «Стон могильщика»' });

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
    try {
        const result = await advanceTutorialEquipmentStep(createPgTutorialProgressRepository(), {
            userId, expectedStep: 1, nextStep: 2, requiredSlot: 'weapon1',
            missingMessage: 'Сначала наденьте меч',
        });
        res.json(result);
    } catch (error: any) {
        if (error?.message === 'User not found') return res.status(404).json({ error: error.message });
        if (['Неверный шаг обучения', 'Сначала наденьте меч'].includes(error?.message)) {
            return res.status(400).json({ error: error.message });
        }
        throw error;
    }
});

// Step 2→3: Tutorial craft — 100% success, creates shield from Пыль забвения
router.post('/tutorial/craft', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 2) return res.status(400).json({ error: 'Неверный шаг обучения' });

    const shieldItem = {
        id: Date.now() + Math.random(), name: 'Гробовая преграда', slot: 'shield',
        rarity_id: 0, rarity_display: 'Хлам', rarity_color: '#888888',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 },
        upgradeLevel: 0, image: 'shield/shield_gray.webp', cost: 10,
    };
    try {
        await grantTutorialCraftReward(createPgTutorialRewardRepository(), {
            userId, shield: shieldItem, dustId: 1,
        });
    } catch (error) {
        if (tutorialRewardError(res, error)) return;
        throw error;
    }

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
    try {
        const result = await advanceTutorialEquipmentStep(createPgTutorialProgressRepository(), {
            userId, expectedStep: 3, nextStep: 4, requiredSlot: 'shield',
            missingMessage: 'Сначала наденьте щит',
        });
        res.json(result);
    } catch (error: any) {
        if (error?.message === 'User not found') return res.status(404).json({ error: error.message });
        if (['Неверный шаг обучения', 'Сначала наденьте щит'].includes(error?.message)) {
            return res.status(400).json({ error: error.message });
        }
        throw error;
    }
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

    try {
        await advanceTutorialArenaStep(createPgTutorialProgressRepository(), {
            userId, now: Math.floor(Date.now() / 1000),
        });
    } catch (error: any) {
        if (error?.message === 'User not found') return res.status(404).json({ error: error.message });
        if (error?.message === 'Неверный шаг обучения') return res.status(400).json({ error: error.message });
        throw error;
    }

    res.json({ success: true, steps, nextStep: 5 });
});

// Step 5→complete: Finish tutorial, give 1000 silver
router.post('/tutorial/complete', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.tutorial_step || 0) !== 5) return res.status(400).json({ error: 'Неверный шаг обучения' });

    const reward = 1000;
    try {
        await completeTutorial(createPgTutorialRewardRepository(), { userId, reward });
    } catch (error) {
        if (tutorialRewardError(res, error)) return;
        throw error;
    }

    res.json({ success: true, reward, nextStep: 6, completed: true });
});

export default router;
