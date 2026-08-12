"use strict";
/**
 * Чистка инвентарей: удаляет крафтовые предметы с невалидными id (нет в craft_items),
 * и предметы с кривыми данными (например, type=craft_item но с slot от экипировки).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    const log = [];
    const backupPath = path.join(__dirname, '..', 'backup_cleanup.json');
    // Загружаем валидные craft_item IDs
    const validIds = new Set();
    const craftItems = await index_1.db.query('SELECT id, name, rarity_id, type FROM craft_items');
    for (const ci of craftItems)
        validIds.add(ci.id);
    const craftIdToName = new Map();
    const craftIdToRarity = new Map();
    const craftIdToType = new Map();
    for (const ci of craftItems) {
        craftIdToName.set(ci.id, ci.name);
        craftIdToRarity.set(ci.id, ci.rarity_id);
        craftIdToType.set(ci.id, ci.type);
    }
    const users = await index_1.db.query('SELECT id, inventory FROM users WHERE inventory IS NOT NULL');
    console.log(`Проверяем ${users.length} пользователей...`);
    for (const user of users) {
        let inventory;
        try {
            inventory = JSON.parse(user.inventory || '[]');
        }
        catch {
            continue;
        }
        if (!Array.isArray(inventory))
            continue;
        const toRemove = [];
        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];
            // Пропускаем не-крафтовые
            if (item.type !== 'craft_item')
                continue;
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
            const dirtyFields = [];
            if (item.slot)
                dirtyFields.push('slot');
            if (item.bonuses)
                dirtyFields.push('bonuses');
            if (item.extra)
                dirtyFields.push('extra');
            if (item.curseStat)
                dirtyFields.push('curseStat');
            if (item.upgradeLevel !== undefined)
                dirtyFields.push('upgradeLevel');
            if (dirtyFields.length > 0) {
                for (const f of dirtyFields)
                    delete item[f];
                log.push({ uid: user.id, action: 'fixed', item, reason: `удалены поля экипировки: ${dirtyFields.join(', ')}` });
            }
        }
        // Удаляем призраков (reverse order)
        for (const { idx, item, reason } of toRemove.reverse()) {
            inventory.splice(idx, 1);
            log.push({ uid: user.id, action: 'removed', item, reason });
        }
        if (toRemove.length > 0 || log.some(l => l.uid === user.id && l.action === 'fixed')) {
            await index_1.db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), user.id]);
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
//# sourceMappingURL=cleanup-inventory.js.map