"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSalaryScheduler = startSalaryScheduler;
// Жалование: 10 серебра минимум +1 за каждую PvE-победу (в 00 минут)
// Стражники: бонус от кармы ±100% (karma=-100→0%, karma=0→100%, karma=100→200%)
const index_1 = require("../db/index");
const logger_1 = __importDefault(require("../logger"));
let lastSalaryHour = -1;
function startSalaryScheduler() {
    setInterval(async () => {
        const now = new Date();
        if (now.getMinutes() !== 0 || now.getHours() === lastSalaryHour)
            return;
        lastSalaryHour = now.getHours();
        try {
            const users = await index_1.db.query('SELECT id, username, pvewins, faction, karma FROM users WHERE id > 0');
            if (users.length === 0)
                return;
            const nowISO = new Date().toISOString();
            let paidCount = 0;
            for (const u of users) {
                let baseAmount = 10 + (u.pveWins || 0);
                // Бонус кармы для Стражников: ±100% линейно
                if (u.faction === 'guard') {
                    const karma = u.karma || 0;
                    const mult = 1 + karma / 100; // -100→0, 0→1, 100→2
                    baseAmount = Math.max(0, Math.round(baseAmount * mult));
                }
                if (baseAmount <= 0)
                    continue;
                await index_1.db.run('UPDATE users SET money = money + ? WHERE id = ?', [baseAmount, u.id]);
                await index_1.db.run("INSERT INTO chat_messages (senderId, targetId, content, createdAt) VALUES (0, ?, ?, ?)", [u.id, `💰 Жалование: +${baseAmount} серебра`, nowISO]);
                paidCount++;
            }
            if (paidCount > 0) {
                logger_1.default.info(`Salary: paid ${paidCount} players`);
            }
        }
        catch (e) {
            logger_1.default.error('PvE salary error:', e?.message || e);
        }
    }, 30000);
}
//# sourceMappingURL=salary.js.map