import { Router } from 'express';
import { db } from '../db/index';
import { currentStats, isSlotCompatible } from '../game/stats';
import { getUserById, getBaseStats, recalcHpOnEquip } from '../db/helpers';

const router = Router();

// Экипировка/снятие предмета
router.post('/character/equip', async (req, res) => {
    const userId = req.userId;
    const { slotId, itemId } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId required' });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inventory: any[] = JSON.parse(user.inventory || '[]');
    const equipment: Record<string, any> = JSON.parse(user.equipment || '{}');
    const currentEquipped = equipment[slotId];

    if (itemId === undefined || itemId === null) {
        if (!currentEquipped) return res.status(400).json({ error: 'Слот пуст' });

        const base = getBaseStats(user);
        const oldStats = currentStats(base, equipment);
        const oldMaxHp = oldStats.hp;

        inventory.push(currentEquipped);
        delete equipment[slotId];

        const newStats = currentStats(base, equipment);
        const newMaxHp = newStats.hp;
        const newHp = recalcHpOnEquip(user.currentHp, oldMaxHp, newMaxHp);

        const now = Math.floor(Date.now() / 1000);
        await db.run('UPDATE users SET inventory = ?, equipment = ?, currentHp = ?, lastHpUpdate = ? WHERE id = ?',
            [JSON.stringify(inventory), JSON.stringify(equipment), newHp, now, userId]);
        return res.json({ inventory, equipment, currentHp: newHp, maxHp: newMaxHp });
    }

    const itemIndex = inventory.findIndex((i: any) => i.id == itemId);
    if (itemIndex === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    const item = inventory[itemIndex];
    if (!item || item.type === 'material' || item.type === 'craft_item') return res.status(400).json({ error: 'Нельзя надеть материал или ресурс' });

    if (!isSlotCompatible(slotId, item)) return res.status(400).json({ error: 'Предмет не подходит к слоту' });

    if (item.name?.includes('двуручн') && slotId !== 'weapon1') {
        return res.status(400).json({ error: 'Двуручное оружие можно надеть только в первый слот' });
    }

    if ((slotId === 'ring1' || slotId === 'ring2') && item.slot?.startsWith('ring')) {
        const otherSlot = slotId === 'ring1' ? 'ring2' : 'ring1';
        const otherItem = equipment[otherSlot];
        if (otherItem && otherItem.name === item.name) {
            return res.status(400).json({ error: 'Нельзя надеть два одинаковых кольца' });
        }
    }

    if (item.name?.includes('двуручн') && slotId === 'weapon1' && equipment['shield']) {
        inventory.push(equipment['shield']);
        delete equipment['shield'];
    }

    if (currentEquipped) {
        inventory.push(currentEquipped);
    }

    const base = getBaseStats(user);
    const oldStats = currentStats(base, equipment);

    inventory.splice(itemIndex, 1);
    equipment[slotId] = item;

    const newStats = currentStats(base, equipment);
    const newMaxHp = newStats.hp;
    const newHp = recalcHpOnEquip(user.currentHp, oldStats.hp, newMaxHp);

    const now = Math.floor(Date.now() / 1000);
    await db.run('UPDATE users SET inventory = ?, equipment = ?, currentHp = ?, lastHpUpdate = ? WHERE id = ?',
        [JSON.stringify(inventory), JSON.stringify(equipment), newHp, now, userId]);

    res.json({ inventory, equipment, currentHp: newHp, maxHp: newMaxHp });
});

// Разобрать предмет(ы)
router.post('/character/salvage', async (req, res) => {
    const userId = req.userId;
    const { itemIds } = req.body;
    if (!itemIds) return res.status(400).json({ error: 'itemIds required' });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let inventory: any[] = JSON.parse(user.inventory || '[]');
    const idsToDelete = new Set(itemIds.map((id: any) => String(id)));

    const materialsToAdd: { rarity_id: number; count: number }[] = [];
    inventory = inventory.filter((item: any) => {
        const itemIdStr = String(item.id);
        if (idsToDelete.has(itemIdStr) && item.type !== 'craft_item') {
            const rarityId = item.rarity_id ?? 0;
            const existing = materialsToAdd.find(m => m.rarity_id === rarityId);
            if (existing) existing.count += 1;
            else materialsToAdd.push({ rarity_id: rarityId, count: 1 });
            return false;
        }
        return true;
    });

    for (const mat of materialsToAdd) {
        const craftItem = await db.one(`
            SELECT c.id, c.name, c.rarity_id, c.type, c.image,
                   r.display_name as rarity_display, r.color as rarity_color
            FROM craft_items c
            JOIN rarities r ON c.rarity_id = r.id
            WHERE c.rarity_id = ?
        `, [mat.rarity_id]) as any;
        if (!craftItem) continue;

        const existingCraft = inventory.find(
            (i: any) => i.type === 'craft_item' && i.id === craftItem.id
        );
        if (existingCraft) {
            existingCraft.count += mat.count;
        } else {
            inventory.push({
                type: 'craft_item',
                id: craftItem.id,
                name: craftItem.name,
                rarity_id: craftItem.rarity_id,
                rarity_display: craftItem.rarity_display,
                rarity_color: craftItem.rarity_color,
                count: mat.count,
                itemType: craftItem.type || 'craft',
                image: craftItem.image || null,
            });
        }
    }

    await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    res.json({ success: true, inventory });
});

// Расширить инвентарь
router.post('/character/expand-inventory', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentSlots = user.inventorySlots || 10;
    const price = 100 * Math.pow(2, currentSlots - 10);
    if (user.money < price) return res.status(400).json({ error: 'Недостаточно монет' });

    await db.run('UPDATE users SET money = money - ?, inventorySlots = inventorySlots + 1 WHERE id = ?',
        [price, userId]);

    res.json({ inventorySlots: currentSlots + 1, moneyAfter: user.money - price });
});

export default router;
