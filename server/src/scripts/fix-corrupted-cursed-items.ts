/**
 * Находит и удаляет битые предметы (сломанные проклятием) во всех инвентарях.
 * Битый = есть curseStat, но нет slot / name / bonuses (затёрты при баге).
 * Логирует uid, что удалено, и сохраняет бэкап.
 */

import { db } from '../db/index';
import * as fs from 'fs';
import * as path from 'path';

interface InventoryItem {
    id?: number | string;
    name?: string;
    slot?: string;
    type?: string;
    bonuses?: Record<string, number>;
    curseStat?: string;
    curseValue?: number;
    curseRank?: number;
    curseName?: string;
    curseColor?: string;
    [key: string]: any;
}

interface UserRow {
    id: number;
    inventory: string; // JSON
}

interface RemovalLog {
    uid: number;
    removed: InventoryItem;
    reason: string;
}

function isCorrupted(item: InventoryItem): { corrupted: boolean; reason?: string } {
    if (!item.curseStat) return { corrupted: false };

    // Craft item with curse — 100% corruption (craft items can't be cursed)
    if (item.type === 'craft_item') {
        return { corrupted: true, reason: 'craft_item с curseStat (экипировка затёрта крафтовым предметом)' };
    }

    // Has curse but no slot — corrupted
    if (!item.slot) {
        return { corrupted: true, reason: 'curseStat без слота (затёрто до type:"item")' };
    }

    // Has curse but no name — corrupted
    if (!item.name) {
        return { corrupted: true, reason: 'curseStat без имени' };
    }

    // Has curse but no bonuses — suspicious, equipment should have bonuses
    if (!item.bonuses || typeof item.bonuses !== 'object' || Object.keys(item.bonuses).length === 0) {
        return { corrupted: true, reason: 'curseStat без bonuses (затёрты статы)' };
    }

    return { corrupted: false };
}

async function main() {
    const log: RemovalLog[] = [];
    const backupPath = path.join(__dirname, '..', 'backup_corrupted_items.json');

    const users = await db.query('SELECT id, inventory FROM users WHERE inventory IS NOT NULL') as UserRow[];
    console.log(`Проверяем ${users.length} пользователей...`);

    for (const user of users) {
        let inventory: InventoryItem[];
        try {
            inventory = JSON.parse(user.inventory || '[]');
        } catch {
            console.log(`  uid=${user.id}: невалидный JSON инвентаря, пропускаем`);
            continue;
        }

        if (!Array.isArray(inventory)) {
            console.log(`  uid=${user.id}: инвентарь не массив, пропускаем`);
            continue;
        }

        const corruptedIndices: { idx: number; item: InventoryItem; reason: string }[] = [];

        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i]!;
            const result = isCorrupted(item);
            if (result.corrupted) {
                corruptedIndices.push({ idx: i, item, reason: result.reason! });
            }
        }

        if (corruptedIndices.length === 0) continue;

        // Remove corrupted items (reverse order to preserve indices)
        const removed: InventoryItem[] = [];
        for (const { idx, item, reason } of corruptedIndices.reverse()) {
            inventory.splice(idx, 1);
            removed.push(item);
            log.push({ uid: user.id, removed: item, reason });
        }

        // Save updated inventory
        await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), user.id]);

        console.log(`  uid=${user.id}: удалено ${removed.length} битых предметов`);
        for (const r of removed) {
            console.log(`    - ${r.name || '<без имени>'} curse=${r.curseStat}+${r.curseValue} (${r.reason})`);
        }
    }

    // Save backup
    fs.writeFileSync(backupPath, JSON.stringify(log, null, 2));
    console.log(`\nБэкап сохранён: ${backupPath}`);
    console.log(`Всего удалено: ${log.length} предметов у ${new Set(log.map(l => l.uid)).size} пользователей`);
}

main().catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
