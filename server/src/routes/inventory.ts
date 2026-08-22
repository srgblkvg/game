import { Router } from 'express';
import { db } from '../db/index';
import { getUserById, getCollectionBonus } from '../db/helpers';
import { getDrinkBonuses } from '../game/drinks';
import { getGuildBonus } from '../game/guildBuildings';
import { refreshCharacter } from '../events';
import { changeEquipment } from '../game/inventoryEquip';
import { createPgEquipmentChangeRepository } from '../game/inventoryEquipRepository';
import { salvageInventory } from '../game/inventorySalvage';
import { createPgInventorySalvageRepository } from '../game/inventorySalvageRepository';
import { reorderInventory, toggleInventoryLock } from '../game/inventoryArrange';
import { createPgInventoryArrangeRepository } from '../game/inventoryArrangeRepository';

const router = Router();

// Экипировка/снятие предмета
router.post('/character/equip', async (req, res) => {
    const userId = req.userId;
    const { slotId, itemId } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId required' });

    const bonusUser = await getUserById(userId);
    if (!bonusUser) return res.status(404).json({ error: 'User not found' });

    try {
        const result = await changeEquipment(createPgEquipmentChangeRepository(), {
            userId,
            slotId,
            itemId: itemId === undefined || itemId === null ? null : itemId,
            now: Math.floor(Date.now() / 1000),
            drinkBonuses: getDrinkBonuses(bonusUser),
            collectionBonus: await getCollectionBonus(userId),
            guildBonus: await getGuildBonus(userId, 'arena'),
        });
        refreshCharacter(userId, 'equipment');
        res.json(result);
    } catch (error: any) {
        const message = error?.message || 'Не удалось изменить экипировку';
        if (message === 'User not found') return res.status(404).json({ error: message });
        const expected = [
            'Некорректный слот экипировки',
            'Слот пуст',
            'Предмет не найден в инвентаре',
            'Предмет заблокирован. Разблокируйте в инвентаре.',
            'Нельзя надеть материал или ресурс',
            'Предмет не подходит к слоту',
            'Двуручное оружие можно надеть только в первый слот',
            'Нельзя надеть два одинаковых кольца',
        ];
        if (expected.includes(message)) return res.status(400).json({ error: message });
        console.error('[character/equip]', error);
        res.status(500).json({ error: 'Не удалось изменить экипировку' });
    }
});

// Разобрать предмет(ы)
router.post('/character/salvage', async (req, res) => {
    const userId = req.userId;
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds)) return res.status(400).json({ error: 'Некорректный список предметов' });

    try {
        const result = await salvageInventory(createPgInventorySalvageRepository(), { userId, itemIds });
        res.json(result);
    } catch (error: any) {
        const message = error?.message || 'Не удалось разобрать предметы';
        if (message === 'User not found') return res.status(404).json({ error: message });
        const expected = [
            'Некорректный список предметов',
            'Предмет заблокирован. Разблокируйте в инвентаре.',
            'Материал для редкости не найден',
        ];
        if (expected.includes(message)) return res.status(400).json({ error: message });
        console.error('[character/salvage]', error);
        res.status(500).json({ error: 'Не удалось разобрать предметы' });
    }
});

// Расширить инвентарь
router.post('/character/expand-inventory', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentSlots = user.inventorySlots || 10;
    const MAX_SLOTS = 30;
    if (currentSlots >= MAX_SLOTS) return res.status(400).json({ error: `Достигнут максимум слотов (${MAX_SLOTS})` });
    const price = 100 * Math.pow(2, currentSlots - 10);
    if (user.money < price) return res.status(400).json({ error: `Недостаточно серебра. Нужно ${price}, есть ${user.money}` });

    await db.run('UPDATE users SET money = money - ?, inventorySlots = inventorySlots + 1 WHERE id = ?',
        [price, userId]);

    res.json({ inventorySlots: currentSlots + 1, moneyAfter: user.money - price });
});

// Сохранить новый порядок предметов в инвентаре (drag & drop)
router.post('/character/reorder-inventory', async (req, res) => {
    const userId = req.userId;
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Неверный формат' });

    try {
        const result = await reorderInventory(createPgInventoryArrangeRepository(), { userId, order });
        res.json(result);
    } catch (error: any) {
        const message = error?.message || 'Не удалось сохранить порядок предметов';
        if (message === 'User not found') return res.status(404).json({ error: message });
        if (message === 'Неверный формат') return res.status(400).json({ error: message });
        console.error('[character/reorder-inventory]', error);
        res.status(500).json({ error: 'Не удалось сохранить порядок предметов' });
    }
});

// Заблокировать/разблокировать предмет в инвентаре
router.post('/character/toggle-lock', async (req, res) => {
    const userId = req.userId;
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId обязателен' });

    try {
        const result = await toggleInventoryLock(createPgInventoryArrangeRepository(), { userId, itemId });
        res.json(result);
    } catch (error: any) {
        const message = error?.message || 'Не удалось изменить блокировку предмета';
        if (message === 'User not found') return res.status(404).json({ error: message });
        if (message === 'Предмет не найден') return res.status(400).json({ error: message });
        console.error('[character/toggle-lock]', error);
        res.status(500).json({ error: 'Не удалось изменить блокировку предмета' });
    }
});

export default router;
