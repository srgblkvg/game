"use strict";
// EventBus — развязка между роутами и WebSocket
// Роуты emit'ят события, WebSocket подписывается.
// Это позволяет менять WebSocket-логику не трогая роуты и наоборот.
Object.defineProperty(exports, "__esModule", { value: true });
exports.on = on;
exports.emit = emit;
exports.markDirty = markDirty;
exports.pushNotification = pushNotification;
exports.broadcast = broadcast;
exports.sendToUser = sendToUser;
exports.sendToGuild = sendToGuild;
const listeners = new Map();
function on(eventType, fn) {
    let set = listeners.get(eventType);
    if (!set) {
        set = new Set();
        listeners.set(eventType, set);
    }
    set.add(fn);
}
function emit(event) {
    const set = listeners.get(event.type);
    if (set)
        set.forEach(fn => fn(event));
}
// ----- Convenience wrappers (для роутов) -----
function markDirty(userId, ...flags) {
    emit({ type: 'markDirty', userId, flags });
}
function pushNotification(userId, notification) {
    emit({ type: 'pushNotification', userId, notification });
}
function broadcast(eventType, data, exceptUserId) {
    const ev = { type: 'broadcast', eventType, data };
    if (exceptUserId !== undefined)
        ev.exceptUserId = exceptUserId;
    emit(ev);
}
function sendToUser(userId, payload) {
    emit({ type: 'sendToUser', userId, payload });
}
function sendToGuild(guildId, payload) {
    emit({ type: 'sendToGuild', guildId, payload });
}
//# sourceMappingURL=events.js.map