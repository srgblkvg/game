"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLoginSuccess = auditLoginSuccess;
exports.auditLoginFailure = auditLoginFailure;
exports.auditRegister = auditRegister;
exports.auditPasswordChange = auditPasswordChange;
exports.auditUsernameChange = auditUsernameChange;
exports.auditWsConnect = auditWsConnect;
exports.auditWsDisconnect = auditWsDisconnect;
exports.auditAccountLocked = auditAccountLocked;
const logger_1 = __importDefault(require("./logger"));
function audit(ev) {
    logger_1.default.info({ audit: true, ...ev }, ev.event);
}
function auditLoginSuccess(username, userId, ip) {
    audit({ event: 'LOGIN_SUCCESS', username, userId, ip });
}
function auditLoginFailure(username, ip, reason) {
    audit({ event: 'LOGIN_FAILURE', username, ip, details: reason });
}
function auditRegister(username, userId, ip) {
    audit({ event: 'REGISTER', username, userId, ip });
}
function auditPasswordChange(userId, username, ip) {
    audit({ event: 'PASSWORD_CHANGE', username, userId, ip });
}
function auditUsernameChange(userId, oldName, newName, ip) {
    audit({ event: 'USERNAME_CHANGE', username: oldName, userId, ip, details: `→ ${newName}` });
}
function auditWsConnect(username, userId, ip) {
    audit({ event: 'WS_CONNECT', username, userId, ip });
}
function auditWsDisconnect(username, userId) {
    audit({ event: 'WS_DISCONNECT', username, userId });
}
function auditAccountLocked(username, ip) {
    audit({ event: 'ACCOUNT_LOCKED', username, ip });
}
//# sourceMappingURL=audit.js.map