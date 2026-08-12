"use strict";
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
exports.applyHpRegen = applyHpRegen;
const index_1 = require("../db/index");
/**
 * Применяет офлайн-регенерацию HP для игрока.
 * Возвращает актуальное currentHp и обновляет БД если изменилось.
 *
 * Реген: 1 HP каждые 10 сек (базовый), ускорение от комнаты:
 *   closet=×3, bed=×10, chamber=×50
 */
async function applyHpRegen(user) {
    const now = Math.floor(Date.now() / 1000);
    const HP_REGEN_SECONDS = 5;
    let hp = user.currentHp;
    const maxHp = user.maxHp;
    let regenRate = 1;
    // Комната
    if (user.roomType && (user.roomUntil || 0) > now) {
        if (user.roomType === 'closet')
            regenRate = 3;
        else if (user.roomType === 'bed')
            regenRate = 10;
        else if (user.roomType === 'chamber')
            regenRate = 50;
        else if (user.roomType === 'lux')
            regenRate = 250;
    }
    // Премиум: ×3 к регену (работает и без комнаты)
    const hasPremium = (user.premiumUntil || 0) > now;
    if (hasPremium)
        regenRate *= 3;
    // Отшельник 2pc: +100% реген HP вне боя
    if (user.hermitRegen)
        regenRate *= 2;
    const elapsed = now - (user.lastHpUpdate || now);
    if (elapsed > 0 && hp < maxHp) {
        // Непрерывный реген: дробные тики, HP целое
        const regenAmount = Math.floor(elapsed * regenRate / HP_REGEN_SECONDS);
        if (regenAmount > 0) {
            hp = Math.min(maxHp, hp + regenAmount);
        }
    }
    if (hp > maxHp)
        hp = maxHp;
    if (hp !== user.currentHp) {
        // Сохраняем остаток времени для точности
        const usedTicks = Math.floor(elapsed * regenRate / HP_REGEN_SECONDS);
        const usedSeconds = Math.ceil(usedTicks * HP_REGEN_SECONDS / regenRate);
        await index_1.db.run('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?', [hp, (user.lastHpUpdate || now) + usedSeconds, user.id]);
        // WS-уведомление клиенту
        const newLastHp = (user.lastHpUpdate || now) + usedSeconds;
        Promise.resolve().then(() => __importStar(require('../events'))).then(m => m.sendToUser(user.id, { type: 'hpUpdate', currentHp: hp, maxHp, lastHpUpdate: newLastHp })).catch(() => { });
    }
    return hp;
}
//# sourceMappingURL=hpRegen.js.map