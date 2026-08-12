"use strict";
/**
 * Находит и удаляет битые предметы (сломанные проклятием) во всех инвентарях.
 * Битый = есть curseStat, но нет slot / name / bonuses (затёрты при баге).
 * Логирует uid, что удалено, и сохраняет бэкап.
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
function isCorrupted(item) {
    if (!item.curseStat)
        return { corrupted: false };
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
    const log = [];
    const backupPath = path.join(__dirname, '..', 'backup_corrupted_items.json');
    const users = await index_1.db.query('SELECT id, inventory FROM users WHERE inventory IS NOT NULL');
    console.log(`Проверяем ${users.length} пользователей...`);
    for (const user of users) {
        let inventory;
        try {
            inventory = JSON.parse(user.inventory || '[]');
        }
        catch {
            console.log(`  uid=${user.id}: невалидный JSON инвентаря, пропускаем`);
            continue;
        }
        if (!Array.isArray(inventory)) {
            console.log(`  uid=${user.id}: инвентарь не массив, пропускаем`);
            continue;
        }
        const corruptedIndices = [];
        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];
            const result = isCorrupted(item);
            if (result.corrupted) {
                corruptedIndices.push({ idx: i, item, reason: result.reason });
            }
        }
        if (corruptedIndices.length === 0)
            continue;
        // Remove corrupted items (reverse order to preserve indices)
        const removed = [];
        for (const { idx, item, reason } of corruptedIndices.reverse()) {
            inventory.splice(idx, 1);
            removed.push(item);
            log.push({ uid: user.id, removed: item, reason });
        }
        // Save updated inventory
        await index_1.db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), user.id]);
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
//# sourceMappingURL=fix-corrupted-cursed-items.js.map