import logger from './logger';

interface AuditEvent {
  event: string;
  username?: string;
  userId?: number;
  ip?: string | undefined;
  details?: string | undefined;
}

function audit(ev: AuditEvent) {
  logger.info({ audit: true, ...ev }, ev.event);
}

export function auditLoginSuccess(username: string, userId: number, ip?: string) {
  audit({ event: 'LOGIN_SUCCESS', username, userId, ip });
}

export function auditLoginFailure(username: string, ip?: string, reason?: string) {
  audit({ event: 'LOGIN_FAILURE', username, ip, details: reason });
}

export function auditRegister(username: string, userId: number, ip?: string) {
  audit({ event: 'REGISTER', username, userId, ip });
}

export function auditPasswordChange(userId: number, username: string, ip?: string) {
  audit({ event: 'PASSWORD_CHANGE', username, userId, ip });
}

export function auditUsernameChange(userId: number, oldName: string, newName: string, ip?: string) {
  audit({ event: 'USERNAME_CHANGE', username: oldName, userId, ip, details: `→ ${newName}` });
}

export function auditWsConnect(username: string, userId: number, ip?: string) {
  audit({ event: 'WS_CONNECT', username, userId, ip });
}

export function auditWsDisconnect(username: string, userId: number) {
  audit({ event: 'WS_DISCONNECT', username, userId });
}

export function auditAccountLocked(username: string, ip?: string) {
  audit({ event: 'ACCOUNT_LOCKED', username, ip });
}
