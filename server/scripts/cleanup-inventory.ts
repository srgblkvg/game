/**
 * Чистка инвентарей: удаляет крафтовые предметы с невалидными id (нет в craft_items),
 * и предметы с кривыми данными (например, type=craft_item но с slot от экипировки).
 */

import { db } from '../db/index';
import * as fs from 'fs';
import * as path from 'path';

interface CleanupLog {
    uid: number;
    action: 'removed' | 'fixed';
    item: any;
    reason: string;
}

async function main() {
    const log: CleanupLog[] = [];
    const backupPath = path.join(__dirname, '..', 'backup_cleanup.json');

    // Загружаем валидные craft_item IDs
    const validIds = new Set<number>();
    const craftItems = await db.query('SELECT id, name, rarity_id, type FROM craft_items') as any[];
    for (const ci of craftItems) validIds.add(ci.id);

    const craftIdToName = new Map<number, string>();
    const craftIdToRarity = new Map<number, number>();
    const craftIdToType = new Map<number, string>();
    for (const ci of craftItems) {
        craftIdToName.set(ci.id, ci.name);
        craftIdToRarity.set(ci.id, ci.rarity_id);
        craftIdToType.set(ci.id, ci.type);
    }

    const users = await db.query('SELECT id, inventory FROM users WHERE inventory IS NOT NULL') as any[];
    console.log(`Проверяем ${users.length} пользователей...`);

    for (const user of users) {
        let inventory: any[];
        try {
            inventory = JSON.parse(user.inventory || '[]');
        } catch {
            continue;
        }
        if (!Array.isArray(inventory)) continue;

        const toRemove: { idx: number; item: any; reason: string }[] = [];

        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];

            // Пропускаем не-крафтовые
            if (item.type !== 'craft_item') continue;

            const itemId = Number(item.id);

            // 1. Невалидный id (нет в craft_items)
            if (!validIds.has(itemId)) {
                toRemove.push({
                    idx: i, item,
                    reason: `id=${item.id} отсутствует в craft_items (призрак)`
                });
                continue;
            }

            // 2. Имя не совпадает с БД
            const dbName = craftIdToName.get(itemId);
            if (dbName && item.name !== dbName) {
                // Чиним имя
                item.name = dbName;
                log.push({ uid: user.id, action: 'fixed', item, reason: `имя "${item.name}" → "${dbName}"` });
            }

            // 3. Редкость не совпадает с БД
            const dbRarity = craftIdToRarity.get(itemId);
            if (dbRarity !== undefined && item.rarity_id !== dbRarity) {
                item.rarity_id = dbRarity;
                log.push({ uid: user.id, action: 'fixed', item, reason: `rarity_id ${item.rarity_id} → ${dbRarity}` });
            }

            // 4. itemType не совпадает с БД
            const dbType = craftIdToType.get(itemId);
            if (dbType && item.itemType !== dbType) {
                item.itemType = dbType;
                log.push({ uid: user.id, action: 'fixed', item, reason: `itemType "${item.itemType}" → "${dbType}"` });
            }

            // 5. Лишние поля от экипировки (slot, bonuses, extra, curseStat, upgradeLevel)
            const dirtyFields: string[] = [];
            if (item.slot) dirtyFields.push('slot');
            if (item.bonuses) dirtyFields.push('bonuses');
            if (item.extra) dirtyFields.push('extra');
            if (item.curseStat) dirtyFields.push('curseStat');
            if (item.upgradeLevel !== undefined) dirtyFields.push('upgradeLevel');

            if (dirtyFields.length > 0) {
                for (const f of dirtyFields) delete item[f];
                log.push({ uid: user.id, action: 'fixed', item, reason: `удалены поля экипировки: ${dirtyFields.join(', ')}` });
            }
        }

        // Удаляем призраков (reverse order)
        for (const { idx, item, reason } of toRemove.reverse()) {
            inventory.splice(idx, 1);
            log.push({ uid: user.id, action: 'removed', item, reason });
        }

        if (toRemove.length > 0 || log.some(l => l.uid === user.id && l.action === 'fixed')) {
            await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), user.id]);
            console.log(`  uid=${user.id}: удалено ${toRemove.length}, исправлено ${log.filter(l => l.uid === user.id && l.action === 'fixed').length}`);
        }
    }

    fs.writeFileSync(backupPath, JSON.stringify(log, null, 2));
    const removed = log.filter(l => l.action === 'removed').length;
    const fixed = log.filter(l => l.action === 'fixed').length;
    console.log(`\nБэкап: ${backupPath}`);
    console.log(`Удалено: ${removed}, Исправлено: ${fixed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
